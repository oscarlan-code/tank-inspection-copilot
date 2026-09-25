import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, extname, join, relative } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = process.env.REPORT_CORPUS_ROOT ?? "/Users/oscar/Public/irs/Sample Reports";
const outputDir = process.env.REPORT_FAMILY_AUDIT_OUTPUT
  ?? new URL("../../output/report-family-audit/", import.meta.url).pathname;
const concurrency = Math.max(1, Math.min(8, Number(process.env.REPORT_FAMILY_AUDIT_CONCURRENCY ?? 4)));

const SIGNALS = {
  standards: {
    api_653: /\bapi\s*(?:standard\s*)?653\b/gi,
    api_650: /\bapi\s*(?:standard\s*)?650\b/gi,
    eemua_159: /\beemua\s*159\b/gi,
    sti_sp001: /\bsti\s*sp[- ]?0*1\b/gi,
  },
  coverage: {
    internal: /\binternal inspection\b|\binternally inspected\b/gi,
    external: /\bexternal inspection\b|\bexternally inspected\b/gi,
    in_service: /\bin[- ]service\b|\bwhile in service\b/gi,
    out_of_service: /\bout[- ]of[- ]service\b|\bdecommissioned\b|\bopened for inspection\b/gi,
  },
  methods: {
    visual: /\bvisual inspection\b|\bvisual examination\b/gi,
    ultrasonic: /\bultrasonic\b|\but thickness\b|\butm\b/gi,
    mfl: /\bmagnetic flux leakage\b|\bmfl\b|\btru[- ]?flux\b/gi,
    mpi: /\bmagnetic particle (?:inspection|examination)\b|\bmpi\b/gi,
    vacuum_box: /\bvacuum box\b/gi,
    settlement: /\bsettlement survey\b|\bedge settlement\b/gi,
    profile_3d: /\b3d scan(?:ning)?\b|\bprofile assessment\b|\broundness\b.*\bplumbness\b/gi,
    calibration: /\bcalibration\b|\bstrapping table\b/gi,
  },
  purposes: {
    post_repair: /\bpost[- ]repair\b|\brepair verification\b|\brepairs? (?:were|has been|have been) (?:completed|carried out)\b/gi,
    repair_consultation: /\bconsultation\b.*\brepair\b|\breview of (?:the )?proposed repairs?\b/gi,
    condition_assessment: /\bcondition assessment\b|\bremaining life\b|\bfitness[- ]for[- ]service\b/gi,
    inspection: /\bscope of inspection\b|\binspection report\b/gi,
  },
  configuration: {
    vertical_ast: /\bvertical\b.*\b(?:aboveground|storage tank)\b|\baboveground storage tank\b/gi,
    horizontal: /\bhorizontal (?:storage )?tank\b|\bhorizontal cylindrical\b/gi,
    floating_roof: /\bfloating roof\b/gi,
    fixed_roof: /\bfixed (?:cone )?roof\b/gi,
  },
};

const files = (await walk(root)).filter((path) => extname(path).toLowerCase() === ".pdf");
await mkdir(outputDir, { recursive: true });

let cursor = 0;
const profiles = new Array(files.length);
await Promise.all(Array.from({ length: concurrency }, async () => {
  while (true) {
    const index = cursor++;
    if (index >= files.length) return;
    profiles[index] = await profilePdf(files[index], index + 1, files.length);
  }
}));

const binaryGroups = groupDuplicates(profiles, "binarySha256");
const textGroups = groupDuplicates(profiles.filter((item) => item.textSha256), "textSha256");
const lineageGroups = groupDuplicates(profiles.filter((item) => item.reportIdentityKey), "reportIdentityKey", false);
const canonicalReports = buildCanonicalReportSet(profiles);
const summary = summarize(profiles, binaryGroups, textGroups, lineageGroups, canonicalReports);

await writeFile(join(outputDir, "report-family-manifest.json"), `${JSON.stringify({
  schemaVersion: 1,
  generatedAtIso: new Date().toISOString(),
  sourceRoot: root,
  classificationPolicy: "content_first_v1",
  safety: {
    sourceFilesModified: false,
    databaseModified: false,
    approvalsModified: false,
    datasetSplitsModified: false,
    titleUsedAsFamilyEvidence: false,
  },
  summary,
  duplicateGroups: { binary: binaryGroups, normalizedText: textGroups },
  revisionLineages: lineageGroups,
  reports: profiles,
}, null, 2)}\n`);
await writeFile(join(outputDir, "canonical-report-set.json"), `${JSON.stringify({
  schemaVersion: 1,
  generatedAtIso: new Date().toISOString(),
  selectionPolicy: "content_role_then_normalized_text_dedup_v1",
  reportCount: canonicalReports.length,
  reports: canonicalReports,
}, null, 2)}\n`);
await writeFile(join(outputDir, "report-family-manifest.csv"), toCsv(profiles));
await writeFile(join(outputDir, "REPORT_FAMILY_AUDIT.md"), toMarkdown(summary, profiles));
console.log(JSON.stringify({ outputDir, ...summary }, null, 2));

async function profilePdf(path, number, total) {
  const bytes = await readFile(path);
  const binarySha256 = sha(bytes);
  let text = "";
  let pageCount = null;
  let extractionError = null;
  try {
    const [textResult, infoResult] = await Promise.all([
      execFileAsync("pdftotext", ["-layout", "-enc", "UTF-8", path, "-"], { maxBuffer: 100 * 1024 * 1024 }),
      execFileAsync("pdfinfo", [path], { maxBuffer: 1024 * 1024 }),
    ]);
    text = textResult.stdout ?? "";
    pageCount = Number(infoResult.stdout.match(/^Pages:\s+(\d+)/m)?.[1] ?? 0) || null;
  } catch (error) {
    extractionError = String(error.stderr || error.message || error).slice(0, 1000);
  }
  const normalized = normalizeText(text);
  const signals = mapSignals(normalized);
  const headings = extractHeadings(text);
  const reportIdentity = extractReportIdentity(text, relative(root, path));
  const documentRole = classifyDocumentRole({ normalized, headings, pageCount, signals, relativePath: relative(root, path) });
  const classification = classifyContent({ normalized, signals, headings, pageCount });
  const quality = extractionQuality(normalized, pageCount, extractionError);
  if (number % 25 === 0 || number === total) process.stderr.write(`profiled ${number}/${total}\n`);
  return {
    relativePath: relative(root, path),
    fileName: basename(path),
    byteSize: bytes.length,
    binarySha256,
    textSha256: normalized ? sha(normalized) : null,
    pageCount,
    extractedCharacters: normalized.length,
    extractionQuality: quality,
    extractionError,
    reportNumber: reportIdentity.reportNumber,
    revision: reportIdentity.revision,
    reportIdentityKey: reportIdentity.key,
    assetLineageKey: reportIdentity.assetLineageKey,
    clientIdentity: reportIdentity.client,
    tankIdentity: reportIdentity.tank,
    publicationStatus: inferPublicationStatus(normalized, relative(root, path)),
    documentRole: documentRole.role,
    documentRoleConfidence: documentRole.confidence,
    documentRoleEvidence: documentRole.evidence,
    signals,
    structuralSignature: {
      headingCount: headings.length,
      headings: headings.slice(0, 80),
      signatureSha256: sha(headings.map(normalizeText).join("|")),
    },
    proposedProfile: classification.profile,
    proposedCoreFamily: classification.family,
    confidence: classification.confidence,
    evidence: classification.evidence,
    ambiguityReasons: [...quality.reasons, ...classification.ambiguityReasons],
    reviewStatus: quality.readable && documentRole.role === "main_report" && classification.confidence >= 0.6
      ? "machine_profiled"
      : "needs_review",
  };
}

function classifyDocumentRole({ normalized, headings, pageCount, signals, relativePath }) {
  const headingText = headings.join(" | ");
  const mainSpine = [
    /scope of inspection/i,
    /inspection and maintenance regime/i,
    /inspection report/i,
    /repair recommendations?|assessment/i,
    /tank inspection checklist/i,
  ].filter((pattern) => pattern.test(headingText)).length;
  const administrative = countAny(normalized, [
    /\bpurchase order\b/, /\binvoice\b/, /\btimesheet\b/, /\bcompletion certificate\b/,
    /\btravel itinerary\b/, /\bmethod statement\b/, /\bquotation\b/,
  ]);
  const specialist = countAny(normalized, [
    /\bmagnetic particle (?:inspection|examination) report\b/,
    /\bmagnetic flux leakage\b/, /\bultrasonic examination report\b/,
    /\bcalibration table\b/, /\bsettlement survey results\b/,
  ]);
  const provenanceHints = [];
  if (/(^|\/)admin(\/|$)/i.test(relativePath)) provenanceHints.push("path:administrative-folder");
  if (/(^|\/)(?:construction drawings?|drawings?|mfl data|data)(\/|$)/i.test(relativePath)) provenanceHints.push("path:supporting-evidence-folder");
  if (/field\s*sheet|fieldsheet/i.test(relativePath)) {
    return { role: "structured_template", confidence: 0.95, evidence: ["provenance:fieldsheet", ...provenanceHints] };
  }
  if (administrative >= 2 || (provenanceHints.includes("path:administrative-folder") && mainSpine === 0)) {
    return { role: "administrative", confidence: administrative >= 2 ? 0.9 : 0.72, evidence: [`administrative-signals:${administrative}`, ...provenanceHints] };
  }
  if (mainSpine >= 2 && (pageCount ?? 0) >= 5) {
    return { role: "main_report", confidence: Math.min(0.98, 0.58 + mainSpine * 0.08), evidence: [`main-spine-headings:${mainSpine}`, `pages:${pageCount}`] };
  }
  if ((pageCount ?? 0) >= 3 && (
    signals.purposes.repair_consultation > 0
    || (signals.purposes.post_repair > 0 && signals.methods.mpi > 0)
    || (signals.methods.calibration > 0 && /\bcalibration (?:data table|report)\b/i.test(headingText))
  )) {
    return { role: "specialist_report", confidence: 0.82, evidence: ["content:specialist-report-purpose", `pages:${pageCount}`] };
  }
  if (specialist >= 1 && /\b(?:inspection|assessment|survey|calibration|examination) report\b/i.test(headingText) && (pageCount ?? 0) >= 4) {
    return { role: "specialist_report", confidence: 0.74, evidence: [`specialist-signals:${specialist}`, "content:report-heading", `pages:${pageCount}`] };
  }
  if (specialist >= 1 && mainSpine < 2) {
    return { role: "specialist_evidence", confidence: 0.76, evidence: [`specialist-signals:${specialist}`, ...provenanceHints] };
  }
  if (provenanceHints.includes("path:supporting-evidence-folder") && mainSpine === 0) {
    return { role: "visual_or_raw_evidence", confidence: 0.7, evidence: provenanceHints };
  }
  if ((pageCount ?? 0) <= 2 && mainSpine === 0) {
    return { role: "supporting_document", confidence: 0.58, evidence: [`pages:${pageCount ?? "unknown"}`] };
  }
  return { role: "unresolved", confidence: 0.35, evidence: [`main-spine-headings:${mainSpine}`, `pages:${pageCount ?? "unknown"}`, ...provenanceHints] };
}

function countAny(text, patterns) { return patterns.filter((pattern) => pattern.test(text)).length; }

function classifyContent({ normalized, signals, headings, pageCount }) {
  if (!normalized) return result("unreadable", {}, 0, [], ["No extractable page text; OCR/visual review required."]);
  const standard = topKeys(signals.standards);
  const coverage = topKeys(signals.coverage);
  const methods = topKeys(signals.methods);
  const purposes = topKeys(signals.purposes);
  const configuration = topKeys(signals.configuration);
  const scopeText = extractSection(normalized, "scope of inspection", [
    "inspection and maintenance regime", "general tank information", "inspection report",
  ]);
  const primaryInspectionScope = inferPrimaryInspectionScope(scopeText);
  const lifecycle = inferLifecycle(normalized, signals);
  const profile = { standard, coverage, primaryInspectionScope, lifecycle, methods, purposes, configuration };
  const scores = new Map();
  add("api653_tank_inspection", score(signals.standards.api_653, 4) + score(signals.purposes.inspection, 2)
    + score(signals.coverage.internal + signals.coverage.external, 2));
  add("settlement_assessment", score(signals.methods.settlement, 5));
  add("dimensional_profile_assessment", score(signals.methods.profile_3d, 5));
  add("post_repair_verification", score(signals.purposes.post_repair, 5) + score(signals.methods.mpi, 2));
  add("repair_engineering_review", score(signals.purposes.repair_consultation, 6));
  add("mfl_floor_assessment", score(signals.methods.mfl, 4) + score(signals.methods.ultrasonic, 1));
  add("calibration", score(signals.methods.calibration, 5));
  const ranked = [...scores].sort((a, b) => b[1] - a[1]);
  const [family, best = 0] = ranked[0] ?? ["unclassified", 0];
  const second = ranked[1]?.[1] ?? 0;
  const headingEvidence = headings.filter((heading) => /scope|inspection|assessment|repair|settlement|calibration/i.test(heading)).slice(0, 8);
  const evidence = [
    ...standard.map((key) => `standard:${key}(${signals.standards[key]})`),
    ...coverage.map((key) => `coverage:${key}(${signals.coverage[key]})`),
    ...methods.map((key) => `method:${key}(${signals.methods[key]})`),
    ...purposes.map((key) => `purpose:${key}(${signals.purposes[key]})`),
    ...headingEvidence.map((heading) => `heading:${heading}`),
  ].slice(0, 24);
  const ambiguityReasons = [];
  if (best < 3) ambiguityReasons.push("No strong content-defined family signal.");
  if (best > 0 && second / best > 0.85) ambiguityReasons.push(`Overlapping family signals: ${family} and ${ranked[1][0]}.`);
  if ((pageCount ?? 0) <= 2) ambiguityReasons.push("Short document may be an appendix or supporting record rather than a complete report.");
  const confidence = Math.max(0, Math.min(0.98, 0.35 + Math.min(best, 10) * 0.055 - (second / Math.max(best, 1)) * 0.18));
  return result(best >= 3 ? family : "unclassified", profile, confidence, evidence, ambiguityReasons);

  function add(key, value) { scores.set(key, value); }
}

function extractSection(text, startMarker, endMarkers) {
  const starts = [];
  for (let index = text.indexOf(startMarker); index >= 0; index = text.indexOf(startMarker, index + startMarker.length)) starts.push(index);
  const candidates = starts.map((start) => {
    const afterStart = start + startMarker.length;
    const ends = endMarkers.map((marker) => text.indexOf(marker, afterStart)).filter((index) => index > afterStart + 80);
    return text.slice(afterStart, ends.length ? Math.min(...ends) : Math.min(text.length, afterStart + 5000));
  });
  return candidates.sort((left, right) => right.length - left.length)[0] ?? "";
}

function inferPrimaryInspectionScope(scopeText) {
  if (!scopeText) return "unknown";
  const internal = /\binternal(?:ly)?\b|\binside (?:the )?tank\b/.test(scopeText);
  const external = /\bexternal(?:ly)?\b|\boutside (?:the )?tank\b/.test(scopeText);
  const inService = /\bin[- ]service\b|\bwhile (?:the tank )?remained in service\b/.test(scopeText);
  if (internal && external) return inService ? "internal_external_in_service" : "internal_external";
  if (internal) return "internal";
  if (external) return inService ? "external_in_service" : "external";
  if (inService) return "in_service_unspecified";
  return "unspecified";
}

function inferLifecycle(text, signals) {
  if (signals.purposes.post_repair > 0 && /\bpost[- ]repair (?:inspection|verification|report)\b/.test(text)) return "post_repair";
  if (signals.purposes.repair_consultation > 0) return "engineering_review";
  if (signals.coverage.in_service > signals.coverage.out_of_service) return "in_service";
  if (signals.coverage.out_of_service > 0) return "out_of_service";
  return "unspecified";
}

function result(family, profile, confidence, evidence, ambiguityReasons) {
  return { family, profile, confidence: Number(confidence.toFixed(3)), evidence, ambiguityReasons };
}

function score(count, cap) { return Math.min(count, cap); }

function mapSignals(text) {
  return Object.fromEntries(Object.entries(SIGNALS).map(([dimension, patterns]) => [
    dimension,
    Object.fromEntries(Object.entries(patterns).map(([key, pattern]) => [key, countMatches(text, pattern)])),
  ]));
}

function countMatches(text, pattern) { return [...text.matchAll(new RegExp(pattern.source, pattern.flags))].length; }
function topKeys(values) { return Object.entries(values).filter(([, count]) => count > 0).sort((a, b) => b[1] - a[1]).map(([key]) => key); }

function extractHeadings(text) {
  const candidates = text.split(/\r?\n/).map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean);
  const headings = candidates.filter((line) => line.length >= 3 && line.length <= 140 && (
    /^\d+(?:\.\d+){0,4}\s+[A-Z]/.test(line)
    || (/^[A-Z][A-Z0-9 &/(),.'-]+$/.test(line) && /[A-Z]{3}/.test(line))
  ));
  return [...new Set(headings)];
}

function extractReportIdentity(text, relativePath) {
  const prefix = text.slice(0, 25000);
  const referencePattern = /\b\d{2}[A-Z]{2,5}\d*(?:-[A-Z0-9]+){1,4}\b/i;
  const labelled = prefix.match(new RegExp(`(?:irs\\s+)?(?:report|job)\\s*(?:no\\.?|number)?\\s*[:#]?\\s*(${referencePattern.source})`, "i"))?.[1];
  const inBody = prefix.match(referencePattern)?.[0];
  const inPath = basename(relativePath, extname(relativePath)).match(referencePattern)?.[0];
  const reportNumber = labelled ?? inBody ?? inPath ?? null;
  const revision = prefix.match(/\brev(?:ision)?\s*[.:#-]?\s*([A-Z0-9.-]+)/i)?.[1] ?? null;
  const key = reportNumber ? normalizeText(reportNumber).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : null;
  const tank = prefix.match(/\btank\s*(?:no\.?|number)?\s*[:#]?\s*([A-Z]{0,4}\s*[- ]?\d+[A-Z]?)/i)?.[1]
    ?.replace(/\s+/g, "").replace(/^-/, "").toUpperCase() ?? null;
  const client = prefix.match(/\bclient\s*:\s*([^\n\r]{3,100})/i)?.[1]
    ?.replace(/\s{2,}.*/, "").replace(/[^A-Z0-9 &().'-]/gi, " ").replace(/\s+/g, " ").trim() ?? null;
  const assetLineageKey = tank
    ? `asset:${normalizeKey(client ?? firstPathSegment(relativePath))}:${normalizeKey(tank)}`
    : key ? `report:${key}` : `content:${sha(normalizeText(prefix)).slice(0, 20)}`;
  return { reportNumber, revision, key, tank, client, assetLineageKey };
}

function normalizeKey(value) { return normalizeText(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "unknown"; }
function firstPathSegment(value) { return String(value).split(/[\\/]/)[0] || "unknown"; }

function inferPublicationStatus(text, relativePath) {
  const firstPages = text.slice(0, 30000);
  if (/\bpreliminary report\b|\bdraft report\b|\bfor review\b/.test(firstPages)
    || /\bpreliminary\b|\bdraft\b|\bfor review\b/i.test(relativePath)) return "preliminary_or_draft";
  if (/\bimages only\b/i.test(relativePath)) return "alternate_rendition";
  if (/\brev(?:ision)?\s*[.:#-]?\s*[a-z0-9.-]+\b/.test(firstPages)) return "issued_revision";
  return "issued_status_unconfirmed";
}

function extractionQuality(text, pageCount, error) {
  const reasons = [];
  const charactersPerPage = text.length / Math.max(pageCount ?? 1, 1);
  if (error) reasons.push("PDF extraction command failed.");
  if (text.length < 500) reasons.push("Very little extractable text; OCR/visual review required.");
  if (charactersPerPage < 100) reasons.push("Low text density; likely scanned or image-heavy.");
  return { readable: !error && text.length >= 500 && charactersPerPage >= 100, charactersPerPage: Math.round(charactersPerPage), reasons };
}

function normalizeText(value) { return String(value ?? "").normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim(); }
function sha(value) { return createHash("sha256").update(value).digest("hex"); }

function groupDuplicates(items, key, duplicatesOnly = true) {
  const groups = new Map();
  for (const item of items) {
    const value = item[key];
    if (!value) continue;
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(item.relativePath);
  }
  return [...groups.entries()].filter(([, paths]) => !duplicatesOnly || paths.length > 1)
    .map(([value, paths]) => ({ [key]: value, count: paths.length, paths })).sort((a, b) => b.count - a.count);
}

function summarize(items, binaryGroups, textGroups, lineageGroups, canonicalReports) {
  const countBy = (field) => Object.fromEntries([...items.reduce((map, item) => map.set(item[field], (map.get(item[field]) ?? 0) + 1), new Map())]
    .sort((a, b) => b[1] - a[1]));
  return {
    pdfCount: items.length,
    readableCount: items.filter((item) => item.extractionQuality.readable).length,
    needsReviewCount: items.filter((item) => item.reviewStatus === "needs_review").length,
    extractionFailureCount: items.filter((item) => item.extractionError).length,
    binaryDuplicateGroupCount: binaryGroups.length,
    normalizedTextDuplicateGroupCount: textGroups.length,
    revisionLineageCount: lineageGroups.filter((group) => group.count > 1).length,
    canonicalUniqueReportCount: canonicalReports.length,
    canonicalPreliminaryOrDraftCount: canonicalReports.filter((item) => item.publicationStatus === "preliminary_or_draft").length,
    byProposedCoreFamily: countBy("proposedCoreFamily"),
    byDocumentRole: countBy("documentRole"),
    byReviewStatus: countBy("reviewStatus"),
  };
}

function buildCanonicalReportSet(items) {
  const candidates = items.filter((item) => ["main_report", "specialist_report"].includes(item.documentRole));
  const groups = new Map();
  for (const item of candidates) {
    const key = item.textSha256 ?? item.binarySha256;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  const reports = [...groups.entries()].map(([contentHash, copies]) => {
    const ranked = [...copies].sort((left, right) => canonicalPathScore(right) - canonicalPathScore(left)
      || left.relativePath.length - right.relativePath.length || left.relativePath.localeCompare(right.relativePath));
    const selected = ranked[0];
    return {
      corpusReportId: `corpus_report_${contentHash.slice(0, 16)}`,
      selectedPath: selected.relativePath,
      duplicatePaths: ranked.slice(1).map((item) => item.relativePath),
      contentSha256: contentHash,
      binarySha256: selected.binarySha256,
      pageCount: selected.pageCount,
      reportNumber: selected.reportNumber,
      revision: selected.revision,
      reportIdentityKey: selected.reportIdentityKey,
      assetLineageKey: selected.assetLineageKey,
      clientIdentity: selected.clientIdentity,
      tankIdentity: selected.tankIdentity,
      publicationStatus: selected.publicationStatus,
      documentRole: selected.documentRole,
      proposedCoreFamily: selected.proposedCoreFamily,
      proposedProfile: selected.proposedProfile,
      confidence: selected.confidence,
      evidence: selected.evidence,
      ambiguityReasons: selected.ambiguityReasons,
    };
  });
  const lineageByReportReference = new Map();
  for (const report of reports) {
    if (!report.reportIdentityKey) continue;
    const current = lineageByReportReference.get(report.reportIdentityKey);
    if (!current || report.assetLineageKey.localeCompare(current) < 0) {
      lineageByReportReference.set(report.reportIdentityKey, report.assetLineageKey);
    }
  }
  for (const report of reports) {
    report.assetLineageKey = lineageByReportReference.get(report.reportIdentityKey) ?? report.assetLineageKey;
  }
  return reports.sort((left, right) => left.selectedPath.localeCompare(right.selectedPath));
}

function canonicalPathScore(item) {
  let value = 0;
  if (!/(^|\/)admin(\/|$)/i.test(item.relativePath)) value += 3;
  if (!/previous inspection|history/i.test(item.relativePath)) value += 2;
  if (item.publicationStatus === "issued_revision") value += 2;
  if (item.publicationStatus === "preliminary_or_draft") value -= 2;
  return value;
}

function toCsv(items) {
  const fields = ["relativePath", "documentRole", "documentRoleConfidence", "pageCount", "extractedCharacters", "proposedCoreFamily", "confidence", "reviewStatus", "reportNumber", "revision", "binarySha256", "textSha256", "ambiguityReasons"];
  const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return `${fields.join(",")}\n${items.map((item) => fields.map((field) => escape(Array.isArray(item[field]) ? item[field].join(" | ") : item[field])).join(",")).join("\n")}\n`;
}

function toMarkdown(summary, items) {
  const rows = Object.entries(summary.byProposedCoreFamily).map(([family, count]) => `| ${family} | ${count} |`).join("\n");
  const roleRows = Object.entries(summary.byDocumentRole).map(([role, count]) => `| ${role} | ${count} |`).join("\n");
  const ambiguous = items.filter((item) => item.reviewStatus === "needs_review").slice(0, 100)
    .map((item) => `- \`${item.relativePath}\`: ${item.ambiguityReasons.join("; ") || "low classification confidence"}`).join("\n");
  return `# Content-first report-family audit\n\nGenerated: ${new Date().toISOString()}\n\nThis audit read every PDF page available through text extraction. It did not modify source files, approvals, dataset splits, the KB, or policy state. Filenames were not used as family evidence. Folder provenance is used only to distinguish administrative/supporting material and never to assign a report family.\n\n## Coverage\n\n- PDFs inspected recursively: ${summary.pdfCount}\n- Readable: ${summary.readableCount}\n- Unique report documents after content deduplication: ${summary.canonicalUniqueReportCount}\n- Preliminary/draft report documents: ${summary.canonicalPreliminaryOrDraftCount}\n- Needs OCR or review: ${summary.needsReviewCount}\n- Extraction command failures: ${summary.extractionFailureCount}\n- Exact binary duplicate groups: ${summary.binaryDuplicateGroupCount}\n- Normalized-text duplicate groups: ${summary.normalizedTextDuplicateGroupCount}\n- Multi-document report-number lineages: ${summary.revisionLineageCount}\n\n## Document roles\n\n| Role | Documents |\n|---|---:|\n${roleRows}\n\n## Provisional content-defined families\n\n| Family | Documents |\n|---|---:|\n${rows}\n\nThese are proposals, not approved KB classifications. Inspection coverage, methods, and configuration remain separate profile dimensions rather than being flattened into the family name.\n\n## Ambiguous or unreadable examples (first 100)\n\n${ambiguous || "None"}\n`;
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  }));
  return nested.flat();
}
