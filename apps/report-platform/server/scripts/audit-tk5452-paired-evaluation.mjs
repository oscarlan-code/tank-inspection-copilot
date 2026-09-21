#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadGenericOutlineHeldOutReview } from '../experiments/generic-outline-review-backend.mjs';
import { validateAndroidV3ProductExport } from '../store.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../docs/reviews/data/tk5452-paired-v1');
const read = async name => JSON.parse(await readFile(join(root, name), 'utf8'));
const manifest = await read('manifest.json');
const review = await read('review.json');
const exportPackage = await read('native-export.json');
const planning = await read('section-planning.json');
const sha = value => createHash('sha256').update(value).digest('hex');

assert.equal(manifest.contractVersion, 'tk5452_paired_manifest_v1');
for (const [name, expected] of Object.entries(manifest.files)) assert.equal(sha(await readFile(join(root, name))), expected, `${name} changed without rebuilding the manifest`);
assert.deepEqual(validateAndroidV3ProductExport(exportPackage), []);
assert.equal(review.preflight.passed, true);
assert.equal(review.source.reportIdentity.jobNumber, '19SE2-1');
assert.equal(review.source.reportIdentity.tankNumber, '5452');
assert.equal(exportPackage.inspectionRecord.tankNumber, '5452');
assert.equal(exportPackage.inspectionRecord.client, 'Shell Eastern Petroleum Pte Ltd');
assert.equal(exportPackage.inspectionRecord.location, 'Pulau Bukom');
assert.equal(exportPackage.attachments.length, 0, 'Cross-report photos must not enter the paired case');
assert.equal(exportPackage.inspectionChecklistItems.length, 195);
assert(exportPackage.inspectionChecklistItems.every(item => item.ratingKey && item.ratingLabel && !item.itemNote));
assert.equal(review.sections.length, 21);
assert.equal(planning.sectionPlans.length, 21);
assert.deepEqual(review.sections.map(item => item.sectionNumber), Array.from({ length: 21 }, (_, index) => String(index + 1)));
assert.equal(review.maintenanceRegimeAiCalls, 0);
assert.equal(review.policyPromotionPerformed, false);
assert.equal(review.productionProfileChanged, false);

const identity = review.sections.find(item => item.sectionNumber === '3');
assert(identity.generatedContent.includes('3 GENERAL TANK INFORMATION'));
assert(identity.generatedContent.includes('Shell Eastern Petroleum Pte Ltd'));
assert(identity.generatedContent.includes('5452'));
assert(identity.generatedContent.includes('3.048 m'));
assert(!/Synthetic Evaluation Client|SYN-025|Synthetic Yard|10 m|12 m/.test(identity.generatedContent));

const scope = review.sections.find(item => item.sectionNumber === '1');
assert.equal((scope.generatedContent.match(/data-evidence-id=/g) ?? []).length, 9);
assert(scope.generatedContent.includes('1 SCOPE OF INSPECTION'));

const findings = review.sections.find(item => item.sectionNumber === '4');
for (const heading of ['DIKED AREA','FOUNDATION','SHELL EXTERNAL','FIXED ROOF EXTERNAL (DOME)','FLOOR INTERNAL (FLAT)']) assert(findings.generatedContent.includes(heading));

const checklist = review.sections.find(item => item.sectionNumber === '7');
assert.equal(checklist.captureAvailability.capturedFactCount, 195);
assert.equal(checklist.evaluation.matchedRequiredFactCount, 195);

const regime = review.sections.find(item => item.sectionNumber === '2');
assert.equal(regime.generationRun.usedLiveModel, false);
const quarantined = review.sections.find(item => item.sectionNumber === '13');
assert(quarantined.captureAvailability.withheldFacts.some(item => /V1302A \/ 19SE1-1/.test(item.text)));

const loaded = await loadGenericOutlineHeldOutReview({ evaluationCaseId: 'eval-paired-tk5452-v1', sectionId: '03-general-information' });
assert.equal(loaded.sections.length, 21);
assert.equal(loaded.benchmarkStatus, 'paired_source_reconstruction');
assert.equal(loaded.generationBackend, 'tk5452_paired_section_generation_v1');

console.log(JSON.stringify({ passed: true, caseId: review.caseId, sections: review.sections.length, capturedRequirements: review.summary.capturedRequirementCount, recoveredRequirements: review.summary.exactlyRecoveredRequirementCount, checklistRows: review.summary.checklistRows, aiSections: review.summary.aiSections }));
