// Read-only assessment, deliberately separate from policy selection/promotion.
export function assessPipelineReadiness(snapshot) {
  const checks = [];
  const add = (id, satisfied, finding, nextAction) => checks.push({ id, status: satisfied ? 'pass' : 'blocked', finding, nextAction });
  add('source_split_integrity', snapshot.kb.crossSplitHashGroups === 0,
    `${snapshot.kb.crossSplitHashGroups} exact-source groups span KB dataset splits.`,
    'Reconcile source renditions with registry lineage groups in a new benchmark snapshot; retain old assignments as history.');
  add('registry_lineage_integrity', snapshot.registry.crossSplitLineages === 0,
    `${snapshot.registry.crossSplitLineages} registry asset lineages span splits.`,
    'Keep revisions and correlated asset reports in one split.');
  add('governed_source_integrity', snapshot.governedIndex.reports > 0 && snapshot.governedIndex.invalidSources === 0,
    `${snapshot.governedIndex.invalidSources} governed sources fail registry, approval or checksum checks.`,
    'Resolve source eligibility before rebuilding derived indexes.');
  add('governed_section_eligibility', snapshot.governedIndex.sections > 0 && snapshot.governedIndex.excludedSections === 0,
    `${snapshot.governedIndex.excludedSections} indexed sections are excluded, unreviewed, or in a non-retrieval lane.`,
    'Build a new versioned index from explicitly included, reviewed sections; recheck eligibility at query time.');
  add('current_native_benchmarks', snapshot.pairs.currentContractRows > 0,
    `${snapshot.pairs.currentContractRows} standardized pairs use current preparation contract ${snapshot.contracts.standardizedPair}.`,
    'Rebuild selected Truth Cases, typed app-shaped captures and independent expected obligations; do not reuse old ready labels.');
  add('mock_input_coverage', snapshot.inspectorRun?.inputReadiness?.status === 'supplied',
    snapshot.inspectorRun?.inputReadiness ? `${snapshot.inspectorRun.inputReadiness.sectionsWithoutInputs} of ${snapshot.inspectorRun.inputReadiness.totalSections} TK5452 sections have no input; partial sections remain explicit.` : 'Current inspector evaluation input-readiness artifact is unavailable.',
    'Complete applicable measurements, layouts, source photos and report-side inputs; declare unavailable information rather than infer it.');
  add('generation_serving_parity', false,
    snapshot.code.plannedRouteEvaluationOnly ? 'Section-planned compilation is selected only in evaluation mode.' : 'Generation route needs verification.',
    'Validate one section compiler and formatter in evaluation and a production shadow path before rollout.');
  add('kb_in_planned_generation', false,
    'No validated historical-guidance adapter/ablation evidence is registered for the section-planned candidate.',
    'Add scoped, approved guidance with source traces; compare identical captures with and without KB. Keep asset history separate and optional.');
  add('independent_holdout', false,
    `${snapshot.outlineExposure.sourceEntries} KB entries informed structure design, including existing validation/hidden splits.`,
    'Select and seal unexposed asset/report groups or prospective app captures; register exposure before inspecting them.');
  add('current_promotion_evidence', snapshot.rewards.currentContractEligible > 0,
    `${snapshot.rewards.currentContractEligible} of ${snapshot.rewards.total} stored rewards satisfy current contract metadata filters.`,
    'Keep prior rewards as historical diagnostics; generate fresh contract-matched results after input and retrieval gates pass.');
  add('review_and_export_validation', false,
    'Independent semantic review, inspector acceptance and browser/export parity evidence are not yet consolidated for the candidate.',
    'Measure required-concept recovery, unsupported claims, protected values, layout fidelity and inspector editing before promotion review.');
  return { contractVersion: 'report_pipeline_readiness_v1', observedAt: snapshot.observedAt,
    auditCompleted: true, readyForPromotionReview: false, productionChanged: false,
    aiCalls: 0, checks, snapshot };
}

export function formatPipelineReadiness(report) {
  const cell = value => String(value).replace(/\|/g, '\\|').replace(/\n/g, ' ');
  return ['# Report-generation pipeline readiness', '', `Observed: ${report.observedAt}. Read-only inspection; no generation, rebuild or promotion.`, '',
    '**Not ready for promotion review.** Audit completion is not report-quality certification.', '',
    '| Check | Status | Evidence | Next action |', '| --- | --- | --- | --- |',
    ...report.checks.map(check => `| ${cell(check.id)} | ${check.status} | ${cell(check.finding)} | ${cell(check.nextAction)} |`), '',
    'Counts refer to distinct stores and contracts. Source records, source-file hashes, asset lineages, sections, capture variants and rewards are not interchangeable denominators.', '',
    'This audit verifies stored metadata and code boundaries. It does not reread every PDF page, verify every S3 object, judge semantic quality or establish that a historically excluded section was actually retrieved.', ''].join('\n');
}
