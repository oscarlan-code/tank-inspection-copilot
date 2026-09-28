import { executePlannedSection } from './generator-registry.mjs';
import { runSectionReview } from './reviewer-registry.mjs';

export async function executeGuardedPlannedSection({reportPlan,sectionInstanceId,sectionPlan,evidenceSnapshot,executionMode}) {
  const generationResult=await executePlannedSection({reportPlan,sectionInstanceId,sectionPlan,evidenceSnapshot,executionMode});
  const preDisplayReview=await runSectionReview({reportPlan,sectionPlan,evidenceSnapshot,generationResult,executionMode});
  const allowed=preDisplayReview.decision==='ready_for_review'&&preDisplayReview.userVisibility==='allowed';
  return {
    contractVersion:'guarded_section_execution_result_v1',generationResult,preDisplayReview,
    presentation:{userVisibility:allowed?'allowed':'blocked',approvalStatus:'not_approved',
      draft:allowed?generationResult.draft:null,blockers:allowed?[]:preDisplayReview.blockers},
  };
}
