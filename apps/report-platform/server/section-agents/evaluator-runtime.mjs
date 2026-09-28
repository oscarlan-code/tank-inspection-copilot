import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export function deepFreeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(deepFreeze);Object.freeze(value);}return value;}
export async function verifyFrozenEvaluationAgent({rootUrl,manifestSha256}){
  const bytes=await readFile(new URL('manifest.json',rootUrl));
  if(sha256(bytes)!==manifestSha256)throw new Error('Frozen evaluation-agent manifest has changed. Create a new release.');
  const manifest=JSON.parse(bytes);
  if(manifest.contractVersion!=='section_evaluation_agent_release_v1'||manifest.executionModes.length!==1||manifest.executionModes[0]!=='evaluation')throw new Error('Unsupported evaluation-agent release contract.');
  for(const [path,expected] of Object.entries(manifest.files)){
    if(!/^[a-zA-Z0-9_./-]+$/.test(path)||path.startsWith('/')||path.split('/').includes('..'))throw new Error('Invalid evaluation-agent path.');
    if(sha256(await readFile(new URL(path,rootUrl)))!==expected)throw new Error(`Frozen evaluation-agent file has changed: ${path}. Create a new release.`);
  }
  for(const path of [manifest.evaluatorInstructions,manifest.evaluatorSpec,manifest.rubric,manifest.outputSchema,manifest.harness,manifest.entryPoint])if(!path||!manifest.files[path])throw new Error('Evaluation-agent controls must be hash-pinned.');
  return deepFreeze({manifest});
}
