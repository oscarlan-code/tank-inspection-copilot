import { extractMeasurementClaims, normalizeMeasurementText } from "./measurement-claims.mjs";
import { parseSectionDocument } from "./report-document.mjs";

export const SECTION_PLAN_EVALUATION_CONTRACT = "section_plan_evaluation_v2";

/**
 * Conservative deterministic checking, not free-form semantic equivalence.
 * The denominator comes from frozen requirements, never selected evidence uses.
 * Approximate narrative matches are left for semantic/human review.
 */
export function evaluateSectionPlanOutput({ sectionPlan, evidenceRecords = [], generatedContent = "", expectedObligations, verifiedArtifacts = [] } = {}) {
  if (!sectionPlan?.sectionId) throw new TypeError("A section plan with sectionId is required.");
  const recordById = new Map(evidenceRecords.map((record) => [record.evidenceId, record]));
  const uses = sectionPlan.evidenceUses ?? [];
  const obligations = expectedObligations ?? sectionPlan.outputObligations ?? [];
  const excludedObligations = obligations.filter((item) => item.required === false || item.role === "supporting"
    || ["withheld", "not_applicable", "source_unavailable"].includes(item.availability));
  const excluded = new Set(excludedObligations);
  const required = obligations.filter((item) => !excluded.has(item));
  const segments = contentSegments(generatedContent, sectionPlan.sectionId, sectionPlan);
  const allMeasurements = segments.flatMap((segment) => extractMeasurementClaims(segment.text).map((claim) => ({ ...claim, segment })));
  const obligationResults = required.map((obligation) => {
    const records = (obligation.evidenceIds ?? []).map((id) => recordById.get(id));
    const routed = (obligation.evidenceIds ?? []).every((id) => uses.some((use) =>
      use.role !== "supporting" && (use.evidenceIds ?? []).includes(id)
      && (!use.sectionId || use.sectionId === sectionPlan.sectionId)
      && (!obligation.targetBlockId || use.blockId === obligation.targetBlockId)));
    const targetSectionId = obligation.sectionId ?? obligation.targetSectionId ?? sectionPlan.sectionId;
    const checks = records.length && records.every(Boolean)
      ? records.map((record) => evaluateRecord({ record, obligation, segments, targetSectionId, allRecords: evidenceRecords, verifiedArtifacts, sectionPlan }))
      : [{ status: "unresolved", reason: "Expected evidence record is absent from the frozen snapshot." }];
    const status = combineStatuses(checks.map((check) => check.status));
    return {
      obligationId: obligation.obligationId,
      evidenceIds: obligation.evidenceIds ?? [],
      entityIds: obligation.entityIds ?? [],
      criticality: obligation.criticality ?? "ordinary",
      targetSectionId,
      routed,
      status,
      checks,
    };
  });
  const satisfied = obligationResults.filter((item) => item.status === "satisfied");
  const missing = obligationResults.filter((item) => item.status === "omitted");
  const unresolved = obligationResults.filter((item) => item.status === "unresolved");
  const changed = obligationResults.filter((item) => item.status === "changed_value");
  const entityErrors = obligationResults.filter((item) => item.status === "entity_mismatch");
  const contradictions = obligationResults.filter((item) => item.status === "contradiction");
  const misplaced = obligationResults.filter((item) => item.status === "misplaced");
  // Check emitted numeric claims against section-authorized evidence, including
  // optional support. Optional evidence is allowed, but its absence is not loss.
  const authorizedIds = new Set(uses.flatMap((use) => use.evidenceIds ?? []));
  for (const obligation of required) for (const id of obligation.evidenceIds ?? []) authorizedIds.add(id);
  const authorized = [...authorizedIds].map((id) => recordById.get(id)).filter(Boolean);
  const claimChecks = allMeasurements.map((claim) => {
    const supportingRecords = authorized.filter((record) => recordClaims(record).some((expected) => sameClaim(expected, claim)));
    const correctEntity = supportingRecords.some((record) => claim.segment.tag === 'p' && ['paired-fields', 'labelled-fields'].includes(claim.segment.reportFormat)
      ? ['identity', 'manual_confirmation'].includes(record.kind) && required.some(obligation => obligation.evidenceIds?.includes(record.evidenceId)
        && strictlyBoundField(claim.segment, record, obligation, sectionPlan))
      : entityMatches(claim.segment.text, record));
    return { claim: claim.expected, text: claim.segment.text, supported: correctEntity, reason: correctEntity ? null
      : supportingRecords.length ? "entity_binding_unverified" : "unsupported_value_or_unit" };
  });
  const unsupportedClaims = claimChecks.filter((claim) => !claim.supported && claim.reason === "unsupported_value_or_unit");
  const uncertainClaims = claimChecks.filter((claim) => !claim.supported && claim.reason === "entity_binding_unverified");
  const supportedClaims = claimChecks.filter((claim) => claim.supported);
  const integrityCount = changed.length + entityErrors.length + contradictions.length;
  const nonSatisfied = obligationResults.filter((item) => item.status !== "satisfied");
  const measuredObligations = obligationResults.filter((item) => item.checks.some((check) => check.measurementCount > 0)
    && !["omitted", "unresolved"].includes(item.status));
  const preserved = measuredObligations.filter((item) => item.status === "satisfied");
  const evaluatedBindings = obligationResults.filter((item) => item.entityIds.length > 0 && !["omitted", "unresolved"].includes(item.status));
  const truthGraphEvaluation = {
    goldStandardType: "section_output_obligations",
    contractVersion: SECTION_PLAN_EVALUATION_CONTRACT,
    observableFactCount: evidenceRecords.length,
    requiredFactCount: required.length,
    requiredSourceFactCount: new Set(required.flatMap((item) => item.evidenceIds ?? [])).size,
    matchedRequiredFactCount: satisfied.length,
    requiredFactRecall: ratio(satisfied.length, required.length),
    requiredFactRecallAvailable: required.length > 0,
    missingRequiredFactIds: [...new Set(nonSatisfied.flatMap((item) => item.evidenceIds))],
    missingRequiredObligationIds: missing.map((item) => item.obligationId),
    protectedFactCount: measuredObligations.length,
    protectedSourceFactCount: new Set(measuredObligations.flatMap((item) => item.evidenceIds)).size,
    protectedFactAccuracy: ratio(preserved.length, measuredObligations.length),
    protectedFactAccuracyAvailable: measuredObligations.length > 0,
    // Compatibility field means actual alteration only, never an omission.
    protectedFactMismatchCount: changed.length + entityErrors.length,
    protectedFactMismatches: [...changed, ...entityErrors].map((item) => ({ obligationId: item.obligationId, factId: item.evidenceIds[0], kind: item.status })),
    claimPrecision: ratio(supportedClaims.length, claimChecks.length),
    claimPrecisionAvailable: claimChecks.length > 0,
    verifiableClaimCount: claimChecks.length,
    supportedClaimCount: supportedClaims.length,
    unsupportedClaimCount: unsupportedClaims.length,
    unsupportedClaims,
    uncertainClaimCount: uncertainClaims.length,
    entityRelationshipAccuracy: ratio(evaluatedBindings.length - evaluatedBindings.filter((item) => item.status === "entity_mismatch").length, evaluatedBindings.length),
    contradictionCount: contradictions.length,
    changedValueCount: changed.length,
    entityMismatchCount: entityErrors.length,
    omittedRequiredCount: missing.length,
    misplacedObligationCount: misplaced.length,
    unresolvedEvaluationCount: unresolved.length + uncertainClaims.length,
    containsGoldContentInGenerationState: false,
    scope: "Required output obligations are fixed before routing. Deterministic narrative checks accept exact normalized statements; ambiguous paraphrases require review. Protected mismatches exclude omissions. Numeric support requires a matching entity in the same statement or table row.",
  };
  const duplicateIds = required.length !== new Set(required.map((item) => item.obligationId)).size;
  const blockerReasons = [
    ...(changed.length ? ["changed_captured_value"] : []),
    ...(entityErrors.length ? ["incorrect_entity_binding"] : []),
    ...(contradictions.length ? ["contradicted_captured_finding"] : []),
    ...(unsupportedClaims.length ? ["unsupported_numeric_claim"] : []),
    ...(duplicateIds ? ["duplicate_output_obligation_ids"] : []),
  ];
  const attentionReasons = [
    ...(missing.length ? ["required_output_omitted"] : []),
    ...(misplaced.length ? ["required_output_misplaced"] : []),
    ...(unresolved.length || uncertainClaims.length ? ["output_equivalence_requires_review"] : []),
    ...(obligationResults.some((item) => !item.routed) ? ["required_output_not_routed"] : []),
    ...((sectionPlan.unresolvedEvidence ?? []).length ? ["unresolved_input_evidence"] : []),
  ];
  return {
    contractVersion: SECTION_PLAN_EVALUATION_CONTRACT,
    denominatorSource: expectedObligations ? "independent_expected_obligations" : "frozen_section_requirements",
    sectionId: sectionPlan.sectionId,
    planId: sectionPlan.planId,
    truthGraphEvaluation,
    obligationResults,
    excludedObligationIds: excludedObligations.map((item) => item.obligationId),
    routingCoverage: ratio(obligationResults.filter((item) => item.routed).length, required.length),
    missingRequiredObligationIds: missing.map((item) => item.obligationId),
    changedValueCount: changed.length,
    entityMismatchCount: entityErrors.length,
    contradictionCount: contradictions.length,
    misplacedObligationIds: misplaced.map((item) => item.obligationId),
    unresolvedEvaluationCount: unresolved.length + uncertainClaims.length,
    integrityFailureCount: integrityCount + unsupportedClaims.length,
    blockerReasons,
    attentionReasons,
    evidenceReviewInput: {
      sectionId: sectionPlan.sectionId,
      requiredEvidence: [...new Set(required.flatMap((item) => item.evidenceIds ?? []))].map((id) => recordById.get(id)).filter(Boolean),
      supportingEvidence: uses.filter((use) => use.role === "supporting").flatMap((use) => use.evidenceIds ?? []).map((id) => recordById.get(id)).filter(Boolean),
      obligations: required,
      instruction: "Required output coverage applies only to obligations. Supporting evidence is permitted context, not an obligation to reproduce. Determine meaning, polarity and entity bindings; report uncertain equivalence for review.",
    },
  };
}

function evaluateRecord({ record, obligation, segments, targetSectionId, allRecords, verifiedArtifacts, sectionPlan }) {
  const hasBlockLocations = segments.some(segment => segment.blockId);
  const atDestination = segment => segment.sectionId === targetSectionId
    && (!obligation.targetBlockId || !hasBlockLocations || segment.blockId === obligation.targetBlockId);
  // Prefer the intended block when the same source has several legitimate uses.
  segments = [...segments].sort((left, right) => Number(atDestination(right)) - Number(atDestination(left)));
  if (record.quality?.issues?.length || (record.quality?.status && !["captured", "reviewed", "verified", "valid", "accepted", "ready", "confirmed"].includes(record.quality.status))) {
    return { evidenceId: record.evidenceId, status: "unresolved", reason: "Input evidence requires review." };
  }
  if(obligation.expected?.artifact) {
    const expected=obligation.expected.artifact;
    const verified=verifiedArtifacts.some(artifact=>artifact.evidenceId===record.evidenceId
      && artifact.sectionId===targetSectionId && artifact.sourceHash===expected.sourceHash
      && artifact.sourcePointer===expected.sourcePointer && artifact.targetKey===expected.targetKey
      && artifact.compilerVersion==='native_layout_v1');
    return {evidenceId:record.evidenceId,status:verified?'satisfied':'unresolved',reason:verified?'Native figure compiler bound to the frozen source.':'Native artifact verification is required; a caption does not establish preservation.'};
  }
  const expectedText = normalize(recordText(record, obligation));
  const expectedClaims = recordClaims(record, obligation);
  const fieldPresentation = ['identity', 'manual_confirmation'].includes(record.kind) ? labelledFieldPresentation(sectionPlan, obligation.targetBlockId) : null;
  if (fieldPresentation) {
    // The opt-in form has a different physical shape from a two-cell field
    // grid. Its explicit binding must verify the whole label/value paragraph;
    // neither a nearby value nor a forged provenance ID establishes recovery.
    const exact = segments.find(segment => strictlyBoundField(segment, record, obligation, sectionPlan, { checkDestination: false }));
    if (exact) return recordResult(record, exact.sectionId === targetSectionId && exact.blockId === obligation.targetBlockId ? 'satisfied' : 'misplaced', expectedClaims, exact);
    const label = normalize(`${fieldLabel(record, fieldPresentation)}:`);
    const candidate = segments.find(segment => segment.tag === 'p' && segment.reportFormat === fieldPresentation.reportFormat
      && (segment.evidenceId === record.evidenceId || normalize(segment.text.replace(/^➢\s*/, '')).startsWith(`${label}:`)));
    if (candidate) {
      const correctlyNamed = normalize(candidate.text.replace(/^➢\s*/, '')).startsWith(`${label}:`);
      return recordResult(record, candidate.evidenceId !== record.evidenceId || candidate.obligationId !== obligation.obligationId || !correctlyNamed ? 'entity_mismatch' : 'changed_value', expectedClaims, candidate);
    }
    return recordResult(record, 'omitted', expectedClaims);
  }
  const exact = segments.find((segment) => expectedText && (segment.text === expectedText
    || entityAliases(record).some(alias => segment.text === normalize(`${alias}: ${expectedText}`))) && entityMatches(segment.text, record));
  if (exact) return recordResult(record, atDestination(exact) ? "satisfied" : "misplaced", expectedClaims, exact);
  const human = value => normalize(String(value ?? '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]/g, ' '));
  if (['identity', 'manual_confirmation'].includes(record.kind)) {
    const field=human(record.payload.fieldKey);
    const value=typeof record.payload.value==='object'?JSON.stringify(record.payload.value):record.payload.value;
    const expectedValue=normalize(`${value}${record.payload.unitCode ? ` ${record.payload.unitCode}` : ''}`);
    const row=segments.find(segment=>segment.cells?.length===2 && human(segment.cells[0])===field && segment.cells[1]===expectedValue);
    if(row) return recordResult(record,atDestination(row)?'satisfied':'misplaced',expectedClaims,row);
    const statement = segments.find(segment => !segment.cells && segment.text === normalize(`${human(record.payload.fieldKey)}: ${expectedValue}`));
    if(statement) return recordResult(record,atDestination(statement)?'satisfied':'misplaced',expectedClaims,statement);
  }
  if(record.kind==='checklist_response') {
    const p=record.payload;
    const expectedCells=[human(p.sectionKey),normalize(p.itemNumber),normalize(p.itemPrompt),normalize(p.ratingLabel),normalize(p.itemNote??'')];
    const row=segments.find(segment=>segment.cells?.length===expectedCells.length && segment.cells.every((cell,index)=>cell===expectedCells[index]));
    if(row) return recordResult(record,atDestination(row)?'satisfied':'misplaced',expectedClaims,row);
    const grid = segments.find(segment => segment.cells?.length >= 9
      && segment.groupHeading === normalize(p.sectionTitle ?? human(p.sectionKey))
      && segment.cells[0] === normalize(p.itemNumber)
      && segment.cells[1] === normalize([p.itemPrompt, p.ratingLabel, p.itemNote].filter(Boolean).join(' '))
      && segment.headers?.length === segment.cells.length
      && segment.headers.slice(2).includes(normalize(p.ratingKey))
      && segment.cells.slice(2).every((cell, index) => cell === (segment.headers[index + 2] === normalize(p.ratingKey) ? '●' : '')));
    if(grid) return recordResult(record,atDestination(grid)?'satisfied':'misplaced',expectedClaims,grid);
  }
  const entitySegments = segments.filter((segment) => entityMatches(segment.text, record));
  const textWords = meaningfulWords(expectedText);
  const related = entitySegments.filter((segment) => tokenCoverage(textWords, meaningfulWords(segment.text)) >= 0.8);
  if (record.kind === "measurement" || obligation.expected?.cells) {
    // Rows retain cell order. Finding the expected number elsewhere is not enough.
    const row = entitySegments.find((segment) => sameOrderedClaims(expectedClaims, extractMeasurementClaims(segment.text, { includeBare: true })));
    if (row) return recordResult(record, atDestination(row) ? "satisfied" : "misplaced", expectedClaims, row);
    const candidate = entitySegments.find((segment) => extractMeasurementClaims(segment.text).length > 0);
    if (candidate) return recordResult(record, alterationKind(record, candidate, allRecords), expectedClaims, candidate);
  }
  for (const segment of related) {
    if (isSimplePolarityChange(expectedText, segment.text)) return recordResult(record, "contradiction", expectedClaims, segment);
    const actual = extractMeasurementClaims(segment.text);
    if (expectedClaims.length && actual.length && !expectedClaims.every((claim) => actual.some((item) => sameClaim(claim, item)))) {
      return recordResult(record, alterationKind(record, segment, allRecords), expectedClaims, segment);
    }
  }
  // Locate an exact statement/value under a different named component. This is
  // an integrity error only when the rest of the statement agrees.
  const wrongEntity = segments.find((segment) => !entityMatches(segment.text, record)
    && expectedClaims.length && expectedClaims.every((claim) => extractMeasurementClaims(segment.text).some((item) => sameClaim(claim, item)))
    && tokenCoverage(withoutEntityWords(textWords, record), meaningfulWords(segment.text)) >= 0.9
    && !allRecords.some((other) => other.entityId !== record.entityId && entityMatches(segment.text, other)
      && recordClaims(other).length && recordClaims(other).every((claim) => extractMeasurementClaims(segment.text).some((item) => sameClaim(claim, item)))));
  if (wrongEntity) return recordResult(record, "entity_mismatch", expectedClaims, wrongEntity);
  if (related.length) return { ...recordResult(record, "unresolved", expectedClaims, related[0]), reason: "Similar wording requires semantic review; token overlap is not proof of recovery." };
  return recordResult(record, "omitted", expectedClaims);
}

function labelledFieldPresentation(sectionPlan, blockId) {
  if (sectionPlan?.catalog?.reportPresentation?.contractVersion !== 'inspection_report_presentation_v1') return null;
  const block = sectionPlan.blocks?.find(entry => entry.blockId === blockId);
  const slot = sectionPlan.catalog.slots?.find(entry => entry.slotKey === block?.slotKey);
  const renderer = slot?.presentation?.renderer;
  if (!['paired_fields', 'labelled_fields'].includes(renderer)) return null;
  return { ...slot.presentation, reportFormat: renderer === 'paired_fields' ? 'paired-fields' : 'labelled-fields' };
}

function fieldLabel(record, presentation) {
  return record.payload.reportLabel ?? presentation.fieldLabels?.[record.payload.fieldKey]
    ?? String(record.payload.fieldKey ?? record.payload.itemLabel ?? record.kind).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]/g, ' ');
}

function strictlyBoundField(segment, record, obligation, sectionPlan, { checkDestination = true } = {}) {
  const presentation = labelledFieldPresentation(sectionPlan, obligation.targetBlockId);
  if (!presentation || segment.tag !== 'p' || segment.reportFormat !== presentation.reportFormat
    || segment.evidenceId !== record.evidenceId || segment.obligationId !== obligation.obligationId) return false;
  const targetSectionId = obligation.sectionId ?? obligation.targetSectionId ?? sectionPlan.sectionId;
  if (checkDestination && (segment.sectionId !== targetSectionId || segment.blockId !== obligation.targetBlockId)) return false;
  // Display values are presentation hints, not authority to replace a fact.
  const value = typeof record.payload.value === 'object' ? JSON.stringify(record.payload.value) : record.payload.value ?? record.displayText;
  const unit = record.payload.unitCode ?? record.payload.unit;
  const expected = `${presentation.renderer === 'paired_fields' ? '➢ ' : ''}${fieldLabel(record, presentation)}: ${value}${unit ? ` ${unit}` : ''}`;
  return segment.text === normalize(expected);
}

function alterationKind(record, segment, allRecords) {
  const actual = extractMeasurementClaims(segment.text);
  const borrowed = allRecords.some((other) => other.evidenceId !== record.evidenceId && other.entityId !== record.entityId
    && recordClaims(other).length > 0 && recordClaims(other).every((claim) => actual.some((item) => sameClaim(claim, item)))
    && !entityMatches(segment.text, other));
  return borrowed ? "entity_mismatch" : "changed_value";
}

function recordResult(record, status, claims, segment = null) {
  return { evidenceId: record.evidenceId, status, measurementCount: claims.length, expectedMeasurements: claims.map((claim) => claim.expected), generatedText: segment?.text ?? null, actualSectionId: segment?.sectionId ?? null };
}

function recordText(record, obligation = {}) {
  const expected = obligation.expected;
  if (expected && typeof expected === "object" && typeof expected.text === "string") return expected.text;
  return record.payload?.text ?? record.displayText ?? (typeof expected === "string" && expected !== record.evidenceId ? expected : "");
}

function recordClaims(record, obligation = {}) {
  const cells = obligation.expected?.cells ?? record.payload?.cells;
  if (Array.isArray(cells)) return cells.flatMap((cell) => extractMeasurementClaims(`${cell.value ?? ""}${cell.unitCode ? ` ${cell.unitCode}` : ""}`, { includeBare: true }));
  if(['identity','manual_confirmation'].includes(record.kind) && record.payload?.unitCode) return extractMeasurementClaims(`${record.payload.value} ${record.payload.unitCode}`);
  return extractMeasurementClaims(recordText(record, obligation));
}

function entityAliases(record) {
  const payload = record.payload ?? {};
  const location = record.locationRef ?? {};
  const explicit = [payload.entityLabel, payload.itemLabel, payload.componentLabel, record.entityLabel,
    location.plateId && `plate ${location.plateId}`, location.elementId, location.laneId && location.course && `${location.laneId}-${location.course}`]
    .filter(Boolean).map(normalize).filter((item) => !["measurement", "inspection", "finding", "ut measurements"].includes(item));
  if (explicit.length) return explicit;
  const component = normalize(recordText(record)).match(/\b(shell|roof|floor|sump|nozzle|pipe|ladder)(?:\s+(?:plate|nozzle))?(?:\s+[a-z]?\d+)?\b/);
  if (component) return [component[0]];
  return [];
}

function entityMatches(text, record) {
  if(['identity','manual_confirmation'].includes(record.kind)) {
    const field=normalize(String(record.payload.fieldKey??'').replace(/([a-z])([A-Z])/g,'$1 $2'));
    return Boolean(field && containsStatement(text,field));
  }
  const aliases = entityAliases(record);
  if (aliases.length) return aliases.some((alias) => containsStatement(text, alias));
  // A full unchanged statement is verifiable even without a separately named
  // physical component. A number alone cannot prove the missing relationship.
  const source = normalize(recordText(record));
  return Boolean(source && source.length > 12 && containsStatement(text, source));
}

function withoutEntityWords(words, record) {
  const aliases = new Set(entityAliases(record).flatMap(meaningfulWords));
  return words.filter((word) => !aliases.has(word));
}

function sameOrderedClaims(expected, actual) {
  if (!expected.length) return false;
  // Permit leading station/plate identifiers, not reordering the actual values.
  for (let start = 0; start <= actual.length - expected.length; start += 1) {
    if (expected.every((claim, index) => sameClaim(claim, actual[start + index]))) return true;
  }
  return false;
}

function sameClaim(left, right) { return left.numeric === right.numeric && left.unit === right.unit; }
function ratio(numerator, denominator) { return denominator ? numerator / denominator : null; }
function combineStatuses(statuses) {
  return ["contradiction", "entity_mismatch", "changed_value", "misplaced", "unresolved", "omitted"].find((status) => statuses.includes(status)) ?? "satisfied";
}
function normalize(value) { return normalizeMeasurementText(decodeHtml(String(value ?? ""))).replace(/[.:;,]+$/g, "").trim(); }
function containsStatement(text, expected) {
  const actual = normalize(text);
  const index = actual.indexOf(expected);
  return index >= 0 && (index === 0 || !/[a-z0-9]/.test(actual[index - 1]))
    && (index + expected.length === actual.length || !/[a-z0-9]/.test(actual[index + expected.length]));
}
const STOP_WORDS = new Set("the a an is are was were be been being in on at of to by with and it its not no never without observed measured recorded found mm cm m ft inches inch in feet foot".split(" "));
function meaningfulWords(value) { return [...new Set(normalize(value).match(/[a-z][a-z0-9_-]*/g) ?? [])].filter((word) => !STOP_WORDS.has(word)); }
function tokenCoverage(expected, actual) { return expected.length ? expected.filter((word) => actual.includes(word)).length / expected.length : 0; }
function isSimplePolarityChange(expected, actual) {
  const negated = (value) => /\b(?:not|no|never|without)\b/.test(value);
  return meaningfulWords(expected).length >= 2 && negated(expected) !== negated(actual)
    && tokenCoverage(meaningfulWords(expected), meaningfulWords(actual)) === 1;
}
function decodeHtml(value) {
  return value.replace(/&quot;/gi, '"').replace(/&#(?:39|x27);|&apos;/gi, "'").replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&amp;/gi, "&");
}
function contentSegments(content, defaultSectionId, sectionPlan) {
  const source = String(content ?? "");
  const document = parseSectionDocument({ sectionId: defaultSectionId, html: source });
  const result = [];
  const nodeText = node => 'text' in node ? node.text : node.tag === 'br' ? ' ' : (node.children ?? []).map(nodeText).join('');
  const rows = node => node.tag === 'tr' ? [node] : (node.children ?? []).flatMap(rows);
  const cellsOf = node => (node.children ?? []).filter(child => ['td', 'th'].includes(child.tag)).map(child => normalize(nodeText(child)));
  const inspectionPresentation = sectionPlan?.catalog?.reportPresentation?.contractVersion === 'inspection_report_presentation_v1';
  function visit(nodes, inherited) {
    let context = { ...inherited };
    for (const node of nodes) {
      if ('text' in node) continue;
      if (node.tag === 'h4') context.groupHeading = normalize(nodeText(node));
      const next = { ...context, sectionId: node.attrs?.['data-section-id'] ?? context.sectionId, blockId: node.attrs?.['data-block-id'] ?? context.blockId };
      if (inspectionPresentation) next.reportFormat = node.attrs?.['data-report-format'] ?? context.reportFormat;
      if (node.tag === 'table') {
        const header = rows(node).find(row => row.children?.some(child => child.tag === 'th') && !row.children?.some(child => child.attrs?.colspan));
        next.headers = header ? cellsOf(header) : [];
      }
      if (['tr', 'li', 'p'].includes(node.tag)) {
        if (node.tag === 'tr' && next.reportFormat === 'paired-fields') { visit(node.children ?? [], next); continue; }
        const cells = node.tag === 'tr' ? cellsOf(node) : null;
        const value = cells ? cells.join(' | ') : nodeText(node);
        const labelledField = node.tag === 'p' && ['paired-fields', 'labelled-fields'].includes(next.reportFormat);
        for (const part of cells || labelledField ? [value] : value.split(/(?<=[.!?])\s+(?=[A-Z])|\n+/)) {
          if (normalize(part)) result.push({ ...next, ...(labelledField ? { tag: node.tag, evidenceId: node.attrs?.['data-evidence-id'], obligationId: node.attrs?.['data-obligation-id'] } : {}), text: normalize(part), cells });
        }
        // Nested lists carry their own statements; table cells are one record.
        if (node.tag === 'li') visit((node.children ?? []).filter(child => ['ul', 'ol'].includes(child.tag)), next);
      } else visit(node.children ?? [], next);
    }
  }
  visit(document.blocks, { sectionId: defaultSectionId, blockId: null });
  return result.length ? result : [{ text: normalize(source.replace(/<[^>]+>/g, ' ')), sectionId: defaultSectionId, blockId: null, cells: null }];
}
