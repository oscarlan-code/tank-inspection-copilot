#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../docs/reviews/data/tk5452-paired-v1');
const reviewPath = join(root, 'review.json');
const manifestPath = join(root, 'manifest.json');
const review = JSON.parse(await readFile(reviewPath, 'utf8'));
const planning = JSON.parse(await readFile(join(root, 'section-planning.json'), 'utf8'));
const controlledStandardSections = new Set(['02-regime', '19-truflux-guidance']);

assert.equal(review.contractVersion, 'tk5452_paired_review_v1');
for (const section of review.sections) {
  const plan = planning.sectionPlans.find(item => item.sectionId === section.sectionId);
  assert(plan, `Missing section plan for ${section.sectionId}`);
  const expectedHeading = `${section.sectionNumber} ${section.title}`;
  const renderedHeading = section.generatedContent.match(/<h2>([\s\S]*?)<\/h2>/)?.[1]
    ?.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  section.metrics.formatMatch = renderedHeading === expectedHeading ? 1 : 0;
  if (!section.generationRun.usedLiveModel) {
    const traced = new Set([...section.generatedContent.matchAll(/data-obligation-id="([^"]+)"/g)].map(match => match[1]));
    const omitted = plan.outputObligations.filter(item => !traced.has(item.obligationId));
    const satisfied = plan.outputObligations.length - omitted.length;
    section.evaluation.matchedRequiredFactCount = satisfied;
    section.metrics.requiredFactRecall = plan.outputObligations.length ? satisfied / plan.outputObligations.length : null;
    section.captureAvailability.omittedCapturedFacts = omitted.map(item => ({ factId: item.obligationId, text: 'Captured requirement was not recovered exactly.' }));
    if (!omitted.length) section.evaluation.attentionReasons = section.evaluation.attentionReasons.filter(reason => !['required_output_omitted','output_equivalence_requires_review'].includes(reason));
    if (controlledStandardSections.has(section.sectionId)) section.metrics.claimPrecision = null;
  }
  const available = [section.metrics.requiredFactRecall, section.metrics.claimPrecision, section.metrics.protectedFactAccuracy, section.metrics.formatMatch].filter(value => value !== null);
  section.metrics.score = !plan.outputObligations.length && plan.missingRequirements.length ? 0 : available.length ? available.reduce((sum, value) => sum + value, 0) / available.length : 0;
  section.metrics.outcomeCode = section.metrics.hardFailure ? 'blocked'
    : plan.missingRequirements.length || section.evaluation.attentionReasons.length ? 'needs_attention' : 'ready_for_review';
}
review.summary.exactlyRecoveredRequirementCount = review.sections.reduce((sum, section) => sum + section.evaluation.matchedRequiredFactCount, 0);
await writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`);

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
manifest.files['review.json'] = createHash('sha256').update(await readFile(reviewPath)).digest('hex');
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ passed: true, recovered: review.summary.exactlyRecoveredRequirementCount, captured: review.summary.capturedRequirementCount, readySections: review.sections.filter(section => section.metrics.outcomeCode === 'ready_for_review').length }));
