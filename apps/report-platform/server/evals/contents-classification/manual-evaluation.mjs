import { createHash } from 'node:crypto';
import { atomizeEvidence } from '../../contents-classification-agent/atomizers/evidence-atomizer/v5/atomizer.mjs';
import { detectReportRoutingHint } from '../../contents-classification-agent/input-guards/evaluation-leakage/v1/guard.mjs';
import { executeContentsClassificationRelease } from '../../contents-classification-agent/release-registry.mjs';

const MODEL_ID = 'gpt-5.6-sol';
const RELEASE_ID = 'contents-classification-evaluation-v1';
const sha256 = (value) => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');

export class ManualClassificationError extends Error {
  constructor(message, statusCode = 400) { super(message); this.name = 'ManualClassificationError'; this.statusCode = statusCode; }
}

function fail(condition, message, statusCode = 400) {
  if (!condition) throw new ManualClassificationError(message, statusCode);
}

export function prepareManualClassificationInput(text) {
  const value = String(text ?? '').replace(/\r\n/g, '\n').trim();
  fail(value.length >= 3, 'Enter an inspector-style note to classify.');
  fail(value.length <= 4000, 'Manual classification input is limited to 4,000 characters.');
  const routingHint = detectReportRoutingHint(value);
  fail(!routingHint, 'Remove explicit report-section, block, gold-label, or routing instructions from the test note.');
  const inputPackageHash = sha256({ contract: 'manual_classification_input_v1', value });
  return {
    contractVersion: 'sealed_classification_input_v1', guardId: 'manual-evaluation-input-guard-v1',
    lineageToken: `manual_${inputPackageHash}`, inputPackageHash,
    sourceExportSha256: null, sourceReceiptSha256: null,
    exportPackage: {
      packageType: 'v3_product_export', schemaVersion: 3, inspectionReference: 'MANUAL-EVALUATION',
      inspectionId: `manual-${inputPackageHash.slice(0, 16)}`, unitProfile: { thicknessUnit: 'mm' },
      inspectionRecord: { generalTankInformation: {} },
      voiceNotes: [{ voiceNoteId: `manual-${inputPackageHash.slice(0, 16)}`, transcriptText: value,
        screenKey: 'findings', screenLabel: 'Findings', cardKey: 'manual_test', fieldKey: 'voice_note' }],
    },
  };
}

export async function classifyManualText({ text, narrativeWorker, modelId = MODEL_ID } = {}) {
  const sealedInput = prepareManualClassificationInput(text);
  const atomization = atomizeEvidence({ sealedInput });
  fail(atomization.evidenceAtoms.length > 0, 'The note did not produce a classifiable text unit.');
  fail(atomization.evidenceAtoms.length <= 20, 'The note produced more than 20 sentences. Split it into a smaller test.');
  const execution = await executeContentsClassificationRelease({
    releaseId: RELEASE_ID, executionMode: 'evaluation', atomization, narrativeWorker, modelId,
  });
  const { classification, guard } = execution;
  fail(guard.decision === 'passed' && guard.sealedClassification, `Classification guard blocked ${guard.issues.length} issue(s).`, 502);
  return {
    contractVersion: 'manual_contents_classification_result_v1', evaluationOnly: true,
    goldComparison: 'not_applicable_for_ad_hoc_input', modelId,
    classifierReleaseId: RELEASE_ID,
    classifierCandidateId: classification.candidateId,
    promptVersion: classification.classificationManifest.promptVersion,
    stages: [
      { id: 'manual-input-guard', label: 'Manual input guard', status: 'pass', detail: 'No explicit report routing or gold-label instruction was found.' },
      { id: 'evidence-atomizer', label: 'Evidence Atomizer v5', status: 'pass', detail: `${atomization.evidenceAtoms.length} atomic claim(s) created.` },
      { id: 'contents-classification-agent', label: 'Contents Classification Agent', status: 'complete', detail: `${RELEASE_ID} returned closed-book section/block proposals.` },
      { id: 'classification-guard', label: 'Classification Guard', status: 'pass', detail: 'Evidence IDs and section/block combinations are valid.' },
    ],
    atoms: atomization.evidenceAtoms.map((atom) => {
      const assignment = classification.classificationAssignments.find((item) => item.evidenceId === atom.evidenceId);
      return { evidenceId: atom.evidenceId, text: atom.displayText, proposedUses: assignment?.uses ?? [],
        feedback: assignment?.feedback ?? '', decisionState: assignment?.decisionState ?? 'missing' };
    }),
    generatedAtIso: new Date().toISOString(),
  };
}

export async function runManualContentsClassification({ text } = {}) {
  process.env.REPORT_PLATFORM_CODEX_MODEL = MODEL_ID;
  const codex = await import('../../codex-cli.mjs');
  const status = codex.getAiStatus();
  fail(status.configured, status.detail, 503);
  return classifyManualText({ text, modelId: status.modelId, narrativeWorker: async ({ prompt, schema }) => {
    const response = await codex.runStructuredCodexJob({ prompt, schema, reasoningEffort: 'medium' });
    return response.parsed;
  } });
}
