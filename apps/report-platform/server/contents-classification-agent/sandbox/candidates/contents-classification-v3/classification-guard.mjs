import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUTLINE = JSON.parse(await readFile(path.resolve(HERE, '../../../outline-profiles/vertical-api653-v2/outline-profile.json'), 'utf8'));
const sections = new Map(OUTLINE.sections.map((item) => [item.sectionId, item]));
const sha256 = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function guardClassification({ classification } = {}) {
  assert.equal(classification?.contractVersion, 'contents_classification_output_v3');
  const atoms = new Map(classification.evidenceAtoms.map((item) => [item.evidenceId, item]));
  const allowedDecisionStates = new Set(['deterministic', 'excluded', 'needs_review', 'reviewed', 'not_run']);
  const issues = [];
  const seen = new Set();
  for (const assignment of classification.classificationAssignments) {
    if (!atoms.has(assignment.evidenceId)) issues.push({ code: 'unknown_evidence_id', evidenceId: assignment.evidenceId });
    if (seen.has(assignment.evidenceId)) issues.push({ code: 'duplicate_evidence_assignment', evidenceId: assignment.evidenceId });
    seen.add(assignment.evidenceId);
    if (!allowedDecisionStates.has(assignment.decisionState)) {
      issues.push({ code: 'invalid_decision_state', evidenceId: assignment.evidenceId, decisionState: assignment.decisionState });
    }
    for (const use of assignment.uses) {
      const section = sections.get(use.sectionId);
      if (!section) issues.push({ code: 'unknown_section', evidenceId: assignment.evidenceId, sectionId: use.sectionId });
      else if (!section.blocks.includes(use.blockId)) issues.push({ code: 'invalid_section_block', evidenceId: assignment.evidenceId, sectionId: use.sectionId, blockId: use.blockId });
    }
    if (assignment.decisionState === 'needs_review' && assignment.uses.some((item) => item.method !== 'llm_proposal')) {
      issues.push({ code: 'invalid_unreviewed_method', evidenceId: assignment.evidenceId });
    }
    if (assignment.decisionState === 'not_run' && assignment.uses.length) {
      issues.push({ code: 'unexecuted_assignment_has_uses', evidenceId: assignment.evidenceId });
    }
    if (atoms.get(assignment.evidenceId)?.kind === 'voice_narrative' && assignment.uses.length > 1) {
      issues.push({ code: 'voice_atom_multiple_primary_uses', evidenceId: assignment.evidenceId });
    }
  }
  for (const evidenceId of atoms.keys()) if (!seen.has(evidenceId)) issues.push({ code: 'missing_evidence_assignment', evidenceId });
  const decision = issues.length ? 'blocked' : 'passed';
  return { contractVersion: 'classification_guard_result_v3', guardId: 'classification-guard-v3', decision,
    issues, classificationSha256: sha256(classification), sealedClassification: decision === 'passed' ? classification : null,
    sectionPackageEligibleAtomCount: classification.classificationAssignments.filter((item) =>
      ['deterministic', 'reviewed'].includes(item.decisionState)).length,
    humanReviewRequiredAtomCount: classification.classificationAssignments.filter((item) => item.decisionState === 'needs_review').length,
    notRunAtomCount: classification.classificationAssignments.filter((item) => item.decisionState === 'not_run').length,
    productEnabled: false };
}

