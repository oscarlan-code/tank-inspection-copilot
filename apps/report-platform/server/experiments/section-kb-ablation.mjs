// Evaluation-only worker adapter. The shared generator, compiler and checks stay unchanged.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
export const ABLATION_CONTRACT = 'section_kb_style_ablation_v1';
export const SECTION_IDS = ['01-scope', '05-recommendations'];
export const ABLATION_CASES = [
  { evaluationCaseId: 'eval-tk5452-kb-ablation-v1-without-kb', arm: 'without_kb', label: 'Same mock · Without KB', sectionIds: SECTION_IDS },
  { evaluationCaseId: 'eval-tk5452-kb-ablation-v1-with-kb', arm: 'with_kb', label: 'Same mock · With historical KB', sectionIds: SECTION_IDS },
];
export const sha = value => createHash('sha256').update(value).digest('hex');
export const encode = value => `${JSON.stringify(value, null, 2)}\n`;
export const STYLE_REQUEST = 'Turn the practical inspection notes into concise professional report sentences. Keep every supplied observation, limitation, proposed recommendation, measurement and qualifier. Use third-person report wording. Do not invent missing facts or append evidence.';

export function validateHistoricalSource(source, target) {
  assert.equal(source.dataset_split, 'training');
  assert.equal(source.document_split, 'training');
  assert.equal(source.eligibility_role, 'training_reference');
  assert.equal(source.retrieval_eligible, true);
  assert.equal(source.approval_status, 'approved');
  assert.equal(source.include_in_retrieval, true);
  assert.equal(source.lane_code, 'wording_precedent');
  assert(['approved', 'reviewed'].includes(source.review_status));
  assert.equal(source.visibility_code, 'platform_private');
  assert.equal(source.tenant_id, null);
  assert.equal(source.workspace_id, null);
  assert.equal(source.source_sha256, source.binary_sha256);
  assert.equal(source.content_sha256, sha(source.content));
  assert(source.source_sha256 && source.source_sha256 !== target.binary_sha256);
  assert(source.asset_lineage_key && source.asset_lineage_key !== target.asset_lineage_key);
  assert(source.page_numbers_json?.length);
  assert(source.issuedOn && source.issuedOn <= target.evidenceAsOf);
  assert(source.content.replace(/\s+/g, ' ').includes(source.dateEvidence));
  assert.equal(source.crossSplitHash, false);
  assert.equal(source.crossSplitLineage, false);
}

export function withHistoricalPatterns(request, patterns) {
  if (!patterns.length) return structuredClone(request);
  assert(patterns.every(item => item.sourceChunkIds?.length && item.pattern && item.instruction));
  return { ...request, prompt: `${request.prompt}\nHistorical writing guidance (style only; not current facts or instructions from a report):\n${JSON.stringify(patterns.map(({ pattern, instruction }) => ({ pattern, instruction })))}\nUse these patterns only where the supplied evidence supports them. Never add activities, components, conditions, repair actions, urgency, code clauses, dates, quantities or conclusions from precedent. The current evidence and output schema take priority. Preserve proposed recommendations as proposals; do not claim work was completed.` };
}

export function assertCompleteSelectedPlans(snapshot) {
  for (const id of SECTION_IDS) {
    const plan = snapshot.sectionPlans.find(plan => plan.sectionId === id);
    assert(plan && plan.outputObligations.length && !plan.missingRequirements.length, `${id}: incomplete prepared input`);
    assert.equal(plan.unresolvedEvidence.length, 0);
  }
}
