import { runStructuredCodexJob } from '../codex-cli.mjs';

export function createCodexGoldJudge({instructions,rubric,outputSchema}) {
  return async function codexGoldJudge(request) {
    const prompt=[instructions,'\nEvaluation rubric:\n',JSON.stringify(rubric,null,2),
      '\nEvaluation input:\n',JSON.stringify(request,null,2),
      '\nReturn only JSON matching the supplied schema. Do not approve, edit or promote the report.'].join('');
    const result=await runStructuredCodexJob({prompt,schema:outputSchema,reasoningEffort:'medium'});
    return {parsed:result.parsed,providerCode:result.aiStatus.provider,modelId:result.aiStatus.modelId,liveModelUsed:true};
  };
}
