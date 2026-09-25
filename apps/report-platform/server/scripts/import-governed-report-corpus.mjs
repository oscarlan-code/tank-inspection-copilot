import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createPostgresDatabase } from "../storage/postgres.mjs";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const manifestPath = process.env.REPORT_CORPUS_MANIFEST
  ?? join(process.cwd(), "output/report-family-audit/canonical-report-set.json");
const manifestBytes = await readFile(manifestPath);
const manifest = JSON.parse(manifestBytes);
const taxonomyVersionId = "report_taxonomy_content_v1";
const taxonomy = {
  hierarchy: ["coreFamily", "primaryInspectionScope", "lifecycle", "methods"],
  sharedDimensions: ["standard", "configuration"],
  familySource: "extracted_report_content_and_structure",
  splitPolicy: "content_family_stratified_asset_lineage_70_15_15_v1",
  draftPolicy: "excluded_from_retrieval_and_evaluation",
  sourceReportRetrievalPolicy: "same_content_and_asset_lineage_forbidden",
};
const db = await createPostgresDatabase({ databaseUrl: process.env.DATABASE_URL });
const nowIso = new Date().toISOString();
const splitAssignments = buildSplitAssignments(manifest.reports);

try {
  await db.transaction(async () => {
    await db.prepare(
      `INSERT INTO report_corpus_taxonomy_versions (
        taxonomy_version_id,schema_version,status_code,definition_json,source_manifest_sha256,created_at_iso
      ) VALUES (?,?,?,?,?,?)
      ON CONFLICT (taxonomy_version_id) DO UPDATE SET
        schema_version=excluded.schema_version,status_code=excluded.status_code,
        definition_json=excluded.definition_json,source_manifest_sha256=excluded.source_manifest_sha256`,
    ).run(taxonomyVersionId, 1, "audited", taxonomy, sha(manifestBytes), nowIso);

    // This registry is a reproducible projection of the immutable manifest. Rebuild the
    // audited version atomically so lineage moves cannot be observed half-applied.
    await db.prepare("DELETE FROM report_corpus_registry WHERE taxonomy_version_id=?").run(taxonomyVersionId);

    for (const report of manifest.reports) {
      const datasetSplit = splitAssignments.get(report.assetLineageKey);
      const ambiguous = report.proposedCoreFamily === "unclassified";
      const draft = report.publicationStatus === "preliminary_or_draft";
      const eligibilityRole = ambiguous
        ? "excluded_ambiguous"
        : draft ? "excluded_draft"
          : datasetSplit === "training" ? "training_reference"
            : datasetSplit === "validation" ? "validation_gold" : "hidden_test_gold";
      const retrievalEligible = eligibilityRole === "training_reference";
      await db.prepare(
        `INSERT INTO report_corpus_registry (
          corpus_report_id,taxonomy_version_id,content_sha256,binary_sha256,selected_relative_path,
          report_reference,revision_code,asset_lineage_key,publication_status,document_role,core_family,
          profile_json,evidence_json,ambiguity_reasons_json,dataset_split,eligibility_role,
          retrieval_eligible,registry_status,created_at_iso,updated_at_iso
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT (corpus_report_id) DO UPDATE SET
          taxonomy_version_id=excluded.taxonomy_version_id,content_sha256=excluded.content_sha256,
          binary_sha256=excluded.binary_sha256,selected_relative_path=excluded.selected_relative_path,
          report_reference=excluded.report_reference,revision_code=excluded.revision_code,
          asset_lineage_key=excluded.asset_lineage_key,publication_status=excluded.publication_status,
          document_role=excluded.document_role,core_family=excluded.core_family,profile_json=excluded.profile_json,
          evidence_json=excluded.evidence_json,ambiguity_reasons_json=excluded.ambiguity_reasons_json,
          dataset_split=excluded.dataset_split,eligibility_role=excluded.eligibility_role,
          retrieval_eligible=excluded.retrieval_eligible,registry_status=excluded.registry_status,
          updated_at_iso=excluded.updated_at_iso`,
      ).run(report.corpusReportId,taxonomyVersionId,report.contentSha256,report.binarySha256,
        report.selectedPath,report.reportNumber,report.revision,report.assetLineageKey,
        report.publicationStatus,report.documentRole,report.proposedCoreFamily,report.proposedProfile,
        JSON.stringify(report.evidence),JSON.stringify(report.ambiguityReasons),datasetSplit,eligibilityRole,
        retrievalEligible,"audited",nowIso,nowIso);
      await db.prepare("DELETE FROM report_corpus_copies WHERE corpus_report_id=?").run(report.corpusReportId);
      const paths = [report.selectedPath, ...(report.duplicatePaths ?? [])];
      for (const [index, relativePath] of paths.entries()) {
        await db.prepare(
          `INSERT INTO report_corpus_copies (corpus_report_id,relative_path,is_selected,created_at_iso)
           VALUES (?,?,?,?)`,
        ).run(report.corpusReportId, relativePath, index === 0, nowIso);
      }
    }
  });
  const counts = await db.prepare(
    `SELECT dataset_split,eligibility_role,COUNT(*)::int count
     FROM report_corpus_registry WHERE taxonomy_version_id=? GROUP BY 1,2 ORDER BY 1,2`,
  ).all(taxonomyVersionId);
  console.log(JSON.stringify({ imported: manifest.reports.length, taxonomyVersionId, counts }, null, 2));
} finally {
  await db.close();
}

function buildSplitAssignments(reports) {
  const byLineage = new Map();
  for (const report of reports) {
    if (!byLineage.has(report.assetLineageKey)) byLineage.set(report.assetLineageKey, []);
    byLineage.get(report.assetLineageKey).push(report);
  }
  const familyLineageCounts = new Map();
  for (const [lineage, members] of byLineage) {
    for (const family of new Set(members.map((item) => item.proposedCoreFamily))) {
      if (family === "unclassified") continue;
      familyLineageCounts.set(family, (familyLineageCounts.get(family) ?? new Set()).add(lineage));
    }
  }
  const strata = new Map();
  for (const [lineage, members] of byLineage) {
    const families = [...new Set(members.map((item) => item.proposedCoreFamily).filter((item) => item !== "unclassified"))];
    const family = families.sort((left, right) =>
      familyLineageCounts.get(left).size - familyLineageCounts.get(right).size || left.localeCompare(right))[0] ?? "unclassified";
    if (!strata.has(family)) strata.set(family, []);
    strata.get(family).push(lineage);
  }
  const assignments = new Map();
  for (const lineages of strata.values()) {
    lineages.sort((left, right) => sha(left).localeCompare(sha(right)));
    const total = lineages.length;
    const validation = total >= 3 ? Math.max(1, Math.round(total * 0.15)) : total === 2 ? 1 : 0;
    const hidden = total >= 3 ? Math.max(1, Math.round(total * 0.15)) : 0;
    const training = total - validation - hidden;
    lineages.forEach((lineage, index) => assignments.set(lineage,
      index < training ? "training" : index < training + validation ? "validation" : "hidden_test"));
  }
  return assignments;
}
function sha(value) { return createHash("sha256").update(value).digest("hex"); }
