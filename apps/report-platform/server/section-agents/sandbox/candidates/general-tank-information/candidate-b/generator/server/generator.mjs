import { createHash, randomUUID } from 'node:crypto';
import { validateSectionEvidencePackage } from '../../../../../../../contents-classification-agent/evaluation-pathway.mjs';
import { validatePackageBoundSectionPlan } from '../../../../../../../report-plans/package-bound-section-plan.mjs';
import {
  ALL_FIELDS,
  BODY_FIELDS,
  FIELD_COUNTS,
  HEADER_FIELDS,
  REPORT_PROFILE_ID,
  SECTION_ID,
  SECTION_TITLE,
  SUPPORT_FIELDS,
  expectedBlockIds,
  fieldDefinitionForSourceKey,
} from './field-contract.mjs';
import {
  escapeReportText,
  parseSectionDocument,
  renderSectionDocumentHtml,
  validateSectionDocument,
} from './report-document.mjs';

export const GENERATOR_ID = 'general-tank-information-generator-candidate-b';
export const GENERATOR_MODE = 'deterministic_package_bound_labelled_fields';

const UNKNOWN = /^(?:not provided|not recorded|not available|unknown(?: carbon steel)?|pending confirmation|-)$/i;
const NOT_APPLICABLE = /^(?:not applicable|n\/a|nil|none)$/i;
const LENGTH_UNIT = /(?:^|\s)(?:mm|cm|m|in|inch|inches|ft|feet)(?:\s|$|[.)])/i;
const THICKNESS_UNIT = /(?:^|\s)(?:mm|cm|in|inch|inches)(?:\s|$|[.)])/i;
const TEMPERATURE_UNIT = /(?:°\s*[cf]|\bdegrees?\s+[cf]\b|\b[cf]\b)/i;

const canonical = (value) => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]])) : item);
const sha256 = (value) => createHash('sha256').update(typeof value === 'string' ? value : canonical(value)).digest('hex');
const present = (value) => value !== null && value !== undefined && String(value).trim() !== '';
const normalize = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const comparable = (value) => normalize(value).toLowerCase();

function scalar(value) {
  return typeof value === 'string' || typeof value === 'boolean'
    || (typeof value === 'number' && Number.isFinite(value));
}

function validateExplicitUnit(definition, value) {
  if (!present(value) || UNKNOWN.test(String(value).trim()) || NOT_APPLICABLE.test(String(value).trim())) return null;
  if (definition.dimension === 'integer') {
    return Number.isInteger(Number(value)) && Number(value) >= 0 ? null : `${definition.label} requires a non-negative integer.`;
  }
  if (!definition.dimension) return null;
  const text = String(value).trim();
  if (definition.dimension === 'length' && !LENGTH_UNIT.test(` ${text} `)) return `${definition.label} requires an explicit source length unit.`;
  if (definition.dimension === 'thickness' && !THICKNESS_UNIT.test(` ${text} `)) return `${definition.label} requires an explicit source thickness unit.`;
  if (definition.dimension === 'temperature' && !TEMPERATURE_UNIT.test(text)) return `${definition.label} requires an explicit source temperature unit.`;
  return null;
}

function validateExecution(execution) {
  if (!execution || execution.contractVersion !== 'package_bound_section_generation_execution_v1'
      || execution.executionMode !== 'evaluation' || execution.productEnabled !== false) {
    throw new Error('Unsupported package-bound generation execution or mode.');
  }
  if (Object.hasOwn(execution, 'gold') || Object.hasOwn(execution, 'goldPacket')
      || Object.hasOwn(execution, 'originalSection')) {
    throw new Error('Generation cannot receive evaluator-only gold.');
  }
  const { reportPlan, sectionPlan, sectionEvidencePackage } = execution;
  validateSectionEvidencePackage(sectionEvidencePackage, { sectionId: SECTION_ID });
  validatePackageBoundSectionPlan({ reportPlan, sectionPlan, sectionEvidencePackage });
  if (reportPlan.reportProfileId !== REPORT_PROFILE_ID || sectionPlan.sectionId !== SECTION_ID
      || sectionPlan.title !== SECTION_TITLE || sectionPlan.candidateBinding.generatorId !== GENERATOR_ID) {
    throw new Error('Execution is not bound to this generator candidate.');
  }
}

function indexEvidence(evidencePackage) {
  const issues = [];
  const byCanonicalKey = new Map();
  const dispositions = [];
  for (const record of evidencePackage.evidenceRecords) {
    if (record.evidenceKind !== 'structured_field' || typeof record.entity?.field !== 'string') {
      issues.push({ evidenceId: record.evidenceId, fieldKey: null, state: 'unsupported', blocking: true,
        reasons: ['General Tank Information accepts reviewed structured-field atoms only.'] });
      dispositions.push({ evidenceId: record.evidenceId, fieldKey: null, status: 'blocked_unsupported',
        reason: 'Evidence is not a structured General Tank Information field.' });
      continue;
    }
    const definition = fieldDefinitionForSourceKey(record.entity.field);
    if (!definition) {
      issues.push({ evidenceId: record.evidenceId, fieldKey: record.entity.field, state: 'unsupported', blocking: true,
        reasons: ['No reviewed General Tank Information output or delegation rule exists for this field.'] });
      dispositions.push({ evidenceId: record.evidenceId, fieldKey: record.entity.field, status: 'blocked_unsupported',
        reason: 'Field is absent from the reviewed section contract.' });
      continue;
    }
    if (!expectedBlockIds(definition).has(record.blockId)) {
      issues.push({ evidenceId: record.evidenceId, fieldKey: definition.key, state: 'wrong_block', blocking: true,
        reasons: [`Field was routed to ${record.blockId}, outside its accepted block contract.`] });
    }
    if (!byCanonicalKey.has(definition.key)) byCanonicalKey.set(definition.key, []);
    byCanonicalKey.get(definition.key).push({ record, definition });
  }
  return { issues, byCanonicalKey, dispositions };
}

function compileField(definition, records, issues, dispositions, status = 'rendered') {
  let value = null;
  let state = 'missing';
  const sourceEvidenceIds = records.map(({ record }) => record.evidenceId);
  const sourcePointers = records.map(({ record }) => record.sourcePointer);
  if (records.length) {
    const values = records.map(({ record }) => record.originalValue);
    const invalid = values.some((item) => !scalar(item));
    const distinct = new Set(values.map(comparable));
    if (invalid || distinct.size !== 1) {
      state = 'conflict';
      issues.push({ fieldKey: definition.key, state, blocking: true,
        reasons: [invalid ? 'Field must contain a scalar source value.' : 'Field aliases contain conflicting source values.'] });
    } else {
      value = values[0];
      state = !present(value) ? 'missing' : UNKNOWN.test(String(value).trim()) ? 'unknown'
        : NOT_APPLICABLE.test(String(value).trim()) ? 'not_applicable' : 'supplied';
      const unitIssue = validateExplicitUnit(definition, value);
      if (unitIssue) {
        state = 'invalid_unit';
        issues.push({ fieldKey: definition.key, state, blocking: true, reasons: [unitIssue] });
      }
    }
    for (const { record } of records) {
      dispositions.push({ evidenceId: record.evidenceId, fieldKey: definition.key, status,
        reason: status === 'rendered' ? `Rendered as ${definition.label}.`
          : status === 'report_header' ? 'Preserved for the report header and not duplicated in the section body.'
            : status === 'applicability_only' ? 'Preserved for report planning; not rendered as a tank-description field.'
              : 'Preserved as traceable support evidence; no reviewed body slot exists.' });
    }
  }
  if (definition.required && ['missing', 'unknown', 'not_applicable', 'invalid_unit'].includes(state)) {
    issues.push({ fieldKey: definition.key, state, blocking: true,
      reasons: [`Required ${definition.label.toLowerCase()} is not established with its source unit where applicable.`] });
  } else if (!definition.required && state === 'missing') {
    issues.push({ fieldKey: definition.key, state, blocking: false,
      reasons: ['Optional field is not recorded in the reviewed section evidence package.'] });
  }
  const displayValue = state === 'conflict' ? 'Conflicting inputs — review required'
    : state === 'missing' ? 'Not recorded' : normalize(value);
  return {
    key: definition.key,
    label: definition.label,
    blockId: definition.blockId,
    required: definition.required,
    group: definition.group,
    value,
    displayValue,
    state,
    sourceEvidenceIds,
    sourcePointers,
    sourceFieldKeys: records.map(({ record }) => record.entity.field),
  };
}

function compile(evidencePackage) {
  const indexed = indexEvidence(evidencePackage);
  const fields = BODY_FIELDS.map((definition) => compileField(
    definition, indexed.byCanonicalKey.get(definition.key) ?? [], indexed.issues, indexed.dispositions, 'rendered',
  ));
  const headerMetadata = HEADER_FIELDS.map((definition) => compileField(
    definition, indexed.byCanonicalKey.get(definition.key) ?? [], indexed.issues, indexed.dispositions, 'report_header',
  ));
  const supportingEvidence = SUPPORT_FIELDS.map((definition) => compileField(
    definition, indexed.byCanonicalKey.get(definition.key) ?? [], indexed.issues, indexed.dispositions,
    definition.disposition,
  ));
  const dispositionIds = new Set(indexed.dispositions.map((item) => item.evidenceId));
  const unaccountedEvidenceIds = evidencePackage.evidenceRecords
    .filter((record) => !dispositionIds.has(record.evidenceId)).map((record) => record.evidenceId);
  if (unaccountedEvidenceIds.length) indexed.issues.push({ fieldKey: null, state: 'unaccounted', blocking: true,
    reasons: [`${unaccountedEvidenceIds.length} evidence record(s) have no reviewed disposition.`] });
  return { fields, headerMetadata, supportingEvidence, issues: indexed.issues,
    evidenceDisposition: indexed.dispositions, unaccountedEvidenceIds };
}

function renderField(field) {
  return `<p data-evidence-id="general-info:${escapeReportText(field.key)}" data-source-evidence-ids="${escapeReportText(field.sourceEvidenceIds.join(','))}" data-laiq-provenance="${field.sourceEvidenceIds.length ? 'reviewed_app_evidence' : 'not_recorded'}">➢ <strong>${escapeReportText(field.label)}:</strong> ${escapeReportText(field.displayValue)}</p>`;
}

function render({ fields, sectionPlan }) {
  const main = fields.filter((field) => field.group !== 'history');
  const history = fields.filter((field) => field.group === 'history');
  const rows = [];
  for (let index = 0; index < main.length; index += 2) {
    rows.push(`<tr><td>${renderField(main[index])}</td><td>${main[index + 1] ? renderField(main[index + 1]) : ''}</td></tr>`);
  }
  const historyRows = history.map((field) => `<tr><td colspan="2">${renderField(field)}</td></tr>`).join('');
  const html = `<section data-section-id="${SECTION_ID}"><h2>${escapeReportText(sectionPlan.title)}</h2><table data-report-format="paired-fields"><tbody>${rows.join('')}</tbody></table><h3>Previous Inspection History</h3><table data-report-format="paired-fields"><tbody>${historyRows}</tbody></table></section>`;
  const document = parseSectionDocument({ sectionId: SECTION_ID, html, planId: sectionPlan.sectionPlanId });
  return { document, content: renderSectionDocumentHtml(document), validation: validateSectionDocument(document) };
}

/** Deterministic candidate: no model, network, retrieval, source report or gold access. */
export function generateGeneralTankInformation(execution) {
  validateExecution(execution);
  const inputSha256 = sha256(execution);
  const compiled = compile(execution.sectionEvidencePackage);
  const rendered = render({ fields: compiled.fields, sectionPlan: execution.sectionPlan });
  const blockers = [
    ...compiled.issues.filter((issue) => issue.blocking).flatMap((issue) => issue.reasons),
    ...rendered.validation.issues,
  ];
  if (sha256(execution) !== inputSha256) throw new Error('Generator mutated its execution input.');
  return {
    contractVersion: 'package_bound_section_generation_result_v1',
    candidate: {
      candidateId: execution.sectionPlan.candidateBinding.candidateId,
      generatorId: GENERATOR_ID,
      candidateManifestSha256: execution.sectionPlan.candidateBinding.candidateManifestSha256,
    },
    section: {
      sectionInstanceId: execution.sectionPlan.sectionInstanceId,
      sectionId: SECTION_ID,
      title: SECTION_TITLE,
      reportProfileId: REPORT_PROFILE_ID,
    },
    sectionPlanRef: {
      sectionPlanId: execution.sectionPlan.sectionPlanId,
      sectionPlanSha256: execution.sectionPlan.sectionPlanSha256,
      sectionEvidencePackageSha256: execution.sectionEvidencePackage.packageSha256,
    },
    draft: {
      content: rendered.content,
      document: rendered.document,
      headerMetadata: compiled.headerMetadata,
      generated: true,
      edited: false,
      approved: false,
      reviewRequired: true,
      userVisibility: 'blocked_pending_pre_display_review',
    },
    validation: {
      valid: blockers.length === 0,
      blockers,
      warnings: compiled.issues.filter((issue) => !issue.blocking).map((issue) => `${issue.fieldKey}: ${issue.reasons.join(' ')}`),
      checks: {
        bodyFieldCount: compiled.fields.length,
        expectedBodyFieldCount: FIELD_COUNTS.body,
        headerMetadataCount: compiled.headerMetadata.length,
        supportingEvidenceFieldCount: compiled.supportingEvidence.length,
        projectedEvidenceCount: execution.sectionEvidencePackage.evidenceRecords.length,
        dispositionCount: compiled.evidenceDisposition.length,
        unaccountedEvidenceCount: compiled.unaccountedEvidenceIds.length,
        packageBoundInputUsed: true,
        classifierHumanReviewComplete: execution.sectionEvidencePackage.humanReviewComplete === true,
        currentFactsFromHistoricalSources: false,
        runtimeRetrievalUsed: false,
        liveModelUsed: false,
        promptUsed: false,
        documentValid: rendered.validation.valid,
      },
    },
    trace: {
      generationRunId: randomUUID(),
      generatedAtIso: new Date().toISOString(),
      executionMode: 'evaluation',
      inputSha256,
      inputPackageHash: execution.sectionEvidencePackage.inputPackageHash,
      sectionEvidencePackageSha256: execution.sectionEvidencePackage.packageSha256,
      sealedClassificationDecisionsSha256: execution.sectionEvidencePackage.sealedDecisionsSha256,
      classifierReleaseId: execution.sectionEvidencePackage.classifierReleaseBinding.releaseId,
      knowledgeBundleId: execution.sectionPlan.candidateBinding.knowledgeBundleId,
      standardObligationPackId: execution.sectionPlan.candidateBinding.standardObligationPackId,
      providerCode: 'deterministic',
      modelId: null,
      promptId: null,
      retrievalKeys: [],
      approvalStatus: 'not_approved',
    },
    evaluationEvidence: {
      fields: compiled.fields,
      headerMetadata: compiled.headerMetadata,
      supportingEvidence: compiled.supportingEvidence,
      issues: compiled.issues,
      evidenceDisposition: compiled.evidenceDisposition,
      unaccountedEvidenceIds: compiled.unaccountedEvidenceIds,
    },
  };
}

export const __test = { compile, validateExplicitUnit, scalar, sha256, ALL_FIELDS };

