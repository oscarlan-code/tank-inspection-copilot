import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUTLINE = JSON.parse(await readFile(path.resolve(HERE, '../../../outline-profiles/vertical-api653-v6/outline-profile.json'), 'utf8'));
const sections = new Map(OUTLINE.sections.map((item) => [item.sectionId, item]));
const sha256 = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function guardClassification({ classification } = {}) {
  assert.equal(classification?.contractVersion, 'contents_classification_output_v10');
  const atoms = new Map(classification.evidenceAtoms.map((item) => [item.evidenceId, item]));
  const allowedDecisionStates = new Set(['deterministic', 'excluded', 'needs_review', 'reviewed', 'not_run']);
  const allowedRouteStates = new Set(['deterministic', 'proposed', 'reviewed', 'unresolved', 'excluded', 'not_run']);
  const issues = [];
  const seen = new Set();
  for (const assignment of classification.classificationAssignments) {
    const atom = atoms.get(assignment.evidenceId);
    if (!atom) issues.push({ code: 'unknown_evidence_id', evidenceId: assignment.evidenceId });
    if (seen.has(assignment.evidenceId)) issues.push({ code: 'duplicate_evidence_assignment', evidenceId: assignment.evidenceId });
    seen.add(assignment.evidenceId);
    if (!allowedDecisionStates.has(assignment.decisionState)) issues.push({ code: 'invalid_decision_state', evidenceId: assignment.evidenceId });
    const sectionDecision = assignment.sectionDecision;
    const blockDecision = assignment.blockDecision;
    if (!sectionDecision || !allowedRouteStates.has(sectionDecision.state)) issues.push({ code: 'invalid_section_decision', evidenceId: assignment.evidenceId });
    if (!blockDecision || !allowedRouteStates.has(blockDecision.state)) issues.push({ code: 'invalid_block_decision', evidenceId: assignment.evidenceId });
    const section = sectionDecision?.sectionId === null ? null : sections.get(sectionDecision?.sectionId);
    if (sectionDecision?.sectionId !== null && !section) issues.push({ code: 'unknown_section', evidenceId: assignment.evidenceId, sectionId: sectionDecision?.sectionId });
    if (sectionDecision?.sectionId === null && blockDecision?.blockId !== null) issues.push({ code: 'block_without_section', evidenceId: assignment.evidenceId });
    if (blockDecision?.blockId !== null && section && !section.blocks.includes(blockDecision.blockId)) issues.push({ code: 'invalid_section_block', evidenceId: assignment.evidenceId, sectionId: sectionDecision.sectionId, blockId: blockDecision.blockId });
    for (const use of assignment.uses) {
      const useSection = sections.get(use.sectionId);
      if (!useSection) issues.push({ code: 'unknown_use_section', evidenceId: assignment.evidenceId, sectionId: use.sectionId });
      else if (!useSection.blocks.includes(use.blockId)) issues.push({ code: 'invalid_use_block', evidenceId: assignment.evidenceId, sectionId: use.sectionId, blockId: use.blockId });
    }
    if (sectionDecision?.sectionId !== null && blockDecision?.blockId !== null) {
      if (!assignment.uses.some((item) => item.sectionId === sectionDecision.sectionId && item.blockId === blockDecision.blockId)) issues.push({ code: 'resolved_route_missing_matching_use', evidenceId: assignment.evidenceId });
    } else if (atom?.kind === 'voice_narrative' && assignment.uses.length) issues.push({ code: 'unresolved_voice_route_has_use', evidenceId: assignment.evidenceId });
    if (atom?.kind === 'voice_narrative' && assignment.uses.length > 1) issues.push({ code: 'voice_atom_multiple_primary_uses', evidenceId: assignment.evidenceId });
    if (assignment.decisionState === 'needs_review' && assignment.uses.some((item) => item.method !== 'llm_proposal')) issues.push({ code: 'invalid_unreviewed_method', evidenceId: assignment.evidenceId });
    if (assignment.decisionState === 'not_run' && (assignment.uses.length || sectionDecision?.sectionId !== null || blockDecision?.blockId !== null)) issues.push({ code: 'unexecuted_assignment_has_route', evidenceId: assignment.evidenceId });
  }
  for (const evidenceId of atoms.keys()) if (!seen.has(evidenceId)) issues.push({ code: 'missing_evidence_assignment', evidenceId });
  const decision = issues.length ? 'blocked' : 'passed';
  return { contractVersion: 'classification_guard_result_v10', guardId: 'classification-guard-v10', decision,
    issues, classificationSha256: sha256(classification), sealedClassification: decision === 'passed' ? classification : null,
    sectionRoutedAtomCount: classification.classificationAssignments.filter((item) => item.sectionDecision?.sectionId !== null).length,
    sectionRoutedBlockUnresolvedAtomCount: classification.classificationAssignments.filter((item) => item.sectionDecision?.sectionId !== null && item.blockDecision?.blockId === null).length,
    sectionPackageEligibleAtomCount: classification.classificationAssignments.filter((item) => ['deterministic', 'reviewed'].includes(item.decisionState) && item.blockDecision?.blockId !== null).length,
    humanReviewRequiredAtomCount: classification.classificationAssignments.filter((item) => item.decisionState === 'needs_review').length,
    notRunAtomCount: classification.classificationAssignments.filter((item) => item.decisionState === 'not_run').length,
    productEnabled: false };
}
