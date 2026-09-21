#!/usr/bin/env node
// Isolated evaluation of the real authenticated upload/import API. No generation.
import assert from 'node:assert/strict';
import { randomBytes, createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, mkdtemp, rm, realpath } from 'node:fs/promises';
import { resolve, join, relative, isAbsolute } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import pg from 'pg';
import { createReportStore, validateAndroidV3ProductExport } from '../store.mjs';
import { createS3ObjectStorage } from '../object-storage.mjs';
import { hashPassword } from '../auth/password-auth.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log('Usage: node --env-file=.env server/scripts/import-syn025-evaluation.mjs --native-dir PATH --output-dir NEW_PATH [--run] [--approved-storage-endpoint URL]\nDefault validates only. --run creates an isolated PostgreSQL database/account, uses the real authenticated API and configured S3 storage, verifies uploaded bytes, then cleans up only this evaluation. A non-local storage endpoint requires the exact explicitly approved URL. No model calls or product configuration changes.');
  process.exit(0);
}
function option(name) { const i=args.indexOf(name); if(i<0||!args[i+1]||args[i+1].startsWith('--'))throw new Error(`${name} required`);return resolve(args[i+1]); }
const input=await realpath(option('--native-dir'));
const output=option('--output-dir');
const delta=relative(input,output);
assert(delta==='..'||delta.startsWith('../')||isAbsolute(delta),'Output must not modify the native input folder');
await mkdir(output, { recursive:false });
const save=(name,value)=>writeFile(join(output,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const exportPath=join(input,'export.json');
const sourceBytes=await readFile(exportPath);
const source=JSON.parse(sourceBytes);
const issues=validateAndroidV3ProductExport(source);
await save('native-import-validation.json',{issues,sourceSha256:sha(sourceBytes),packageType:source.packageType,schemaVersion:source.schemaVersion});
assert.equal(issues.length,0,JSON.stringify(issues));
assert.equal(source.inspectionChecklistItems.length,195);
assert.equal(new Set(source.inspectionChecklistItems.map(row=>row.itemNumber)).size,195);
const objects=[];
const buffers=new Map();
for(const attachment of source.attachments) {
  assert.equal(attachment.fileExists,true,'Missing native media');
  const path=await realpath(join(input,'files',attachment.relativePath));
  const rel=relative(join(input,'files'),path);
  assert(rel && !rel.startsWith('..') && !isAbsolute(rel),'Media path escapes native files');
  const bytes=await readFile(path);
  assert.equal(bytes.length,attachment.fileByteSize);
  buffers.set(attachment.attachmentId,bytes);
  objects.push({attachmentId:attachment.attachmentId,relativePath:attachment.relativePath,mediaType:attachment.mediaType,byteSize:bytes.length,sha256:sha(bytes)});
}
await save('upload-manifest.json',objects);
if(!args.includes('--run')) {
  await save('summary.json',{evaluationOnly:true,nativeValidationPassed:true,checklistResponses:195,mediaCount:objects.length,importAttempted:false});
  console.log('Native package and media validated; --run performs the isolated API import.');
  process.exit(0);
}

const databaseUrl=process.env.REPORT_PLATFORM_TEST_DATABASE_URL??process.env.DATABASE_URL;
assert(databaseUrl,'Configured PostgreSQL database is required');
const databaseHost=new URL(databaseUrl).hostname;
const objectHost=new URL(process.env.REPORT_PLATFORM_S3_ENDPOINT).hostname;
assert(['127.0.0.1','localhost','[::1]'].includes(databaseHost),'This evaluation runner requires a local database endpoint');
const approvedEndpointIndex=args.indexOf('--approved-storage-endpoint');
const approvedEndpoint=approvedEndpointIndex>=0?args[approvedEndpointIndex+1]:null;
assert(['127.0.0.1','localhost','[::1]'].includes(objectHost)||approvedEndpoint===process.env.REPORT_PLATFORM_S3_ENDPOINT,'Non-local storage requires the exact user-approved endpoint argument');
const suffix=`${Date.now()}_${randomBytes(4).toString('hex')}`;
// A separate database prevents unqualified migrations/queries from ever falling
// through to existing application tables via a shared search_path.
const schema=`laiq_syn025_eval_${suffix}`;
const target=new URL(databaseUrl);target.pathname=`/${schema}`;target.searchParams.delete('options');
const client=new pg.Client({connectionString:databaseUrl,ssl:false});
const storage=createS3ObjectStorage();
const scratch=await mkdtemp(join(tmpdir(),'laiq-syn025-import-'));
let store,server,schemaCreated=false,sessionId=null;
const cleanupKeys=new Set();
const result={evaluationOnly:true,runId:suffix,sourceSha256:sha(sourceBytes),nativeValidationPassed:true,importAttempted:false,importSuccessful:false,modelCalled:false,policyPromotionPerformed:false,isolatedDatabase:schema,cleanupCompleted:false};
try {
  await client.connect();
  await storage.ping();
  await client.query(`CREATE DATABASE ${schema}`);schemaCreated=true;
  store=await createReportStore({databaseUrl:target.toString()});
  const password=randomBytes(24).toString('base64url')+'aA1!';
  const username=`syn025.eval.${suffix}`;
  const actor=await store.bootstrapInitialSuperAdmin({displayName:'SYN-025 Evaluation Inspector',passwordHash:await hashPassword(password),tenantId:`tenant-syn025-eval-${suffix}`,tenantName:'SYN-025 Isolated Evaluation',userId:`user-syn025-eval-${suffix}`,usernameNormalized:username,workspaceId:`workspace-syn025-eval-${suffix}`,workspaceName:'SYN-025 Evaluation'});
  const portProbe=createServer();portProbe.listen(0,'127.0.0.1');await once(portProbe,'listening');const port=portProbe.address().port;await new Promise(r=>portProbe.close(r));
  const base=`http://127.0.0.1:${port}`;
  server=spawn(process.execPath,[new URL('../index.mjs',import.meta.url).pathname],{env:{...process.env,DATABASE_URL:target.toString(),REPORT_PLATFORM_API_HOST:'127.0.0.1',REPORT_PLATFORM_API_PORT:String(port),REPORT_PLATFORM_ENABLE_DEMO_DATA:'false',REPORT_PLATFORM_ENABLE_DEVELOPMENT_IDENTITIES:'false',REPORT_PLATFORM_ALLOW_LEGACY_SOURCE_IMPORTS:'false',REPORT_PLATFORM_ARTIFACT_ROOT:join(scratch,'artifacts'),PATH:'/usr/bin:/bin:/usr/sbin:/sbin'},stdio:['ignore','pipe','pipe']});
  let serverLog='';for(const stream of [server.stdout,server.stderr])stream.on('data',data=>{serverLog=(serverLog+data).slice(-12000);});
  let healthy=false;
  for(let n=0;n<120;n++) { try { const r=await fetch(base+'/api/ready',{signal:AbortSignal.timeout(2000)});if(r.ok){healthy=true;break;} }catch{} if(server.exitCode!=null)throw new Error('Isolated API exited before readiness');await new Promise(r=>setTimeout(r,250)); }
  assert(healthy,'Isolated API did not become ready');
  let cookie='';
  async function request(path,{method='GET',body,headers={},authenticated=true}={}) {
    const r=await fetch(base+path,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(authenticated&&cookie?{Cookie:cookie}:{}),...headers},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(90000)});
    const value=await r.json();if(!r.ok)throw new Error(`${method} ${path}: ${r.status} ${value.code??''} ${value.message??''}`);
    return {value,response:r};
  }
  const login=await request('/api/v1/auth/login',{method:'POST',body:{username,password},authenticated:false});
  cookie=login.response.headers.get('set-cookie')?.split(';')[0];assert(cookie,'Normal password login must return a session');
  result.authenticatedActorId=actor.userId;
  result.importAttempted=true;
  const {value:plan}=await request('/api/v1/app/imports/v3-product/upload-sessions',{method:'POST',headers:{'Idempotency-Key':`syn025-eval-${suffix}`},body:{exportPackage:source,objects}});
  sessionId=plan.uploadSessionId;
  assert.equal(plan.objects.length,objects.length);
  const storedSession=await store.getObjectUploadSession({actorUserId:actor.userId,uploadSessionId:sessionId});
  storedSession.objects.forEach(o=>cleanupKeys.add(o.objectKey));
  for(const object of plan.objects) {
    const upload=await fetch(object.uploadUrl,{method:object.method,headers:object.requiredHeaders,body:buffers.get(object.attachmentId),signal:AbortSignal.timeout(90000)});
    assert(upload.ok,`Signed media upload failed: ${object.attachmentId}, status ${upload.status}`);
  }
  const {value:finalized}=await request(`/api/v1/app/imports/v3-product/upload-sessions/${sessionId}/finalize`,{method:'POST',body:{}});
  assert.equal(finalized.status,'imported');assert.equal(finalized.verifiedObjectCount,objects.length);
  const jobId=finalized.reportJob.reportJobId;
  const {value:state}=await request(`/api/v1/report-jobs/${jobId}`);
  const sourceKey=state.reportJob.sourceRevision.sourceObjectKey;cleanupKeys.add(sourceKey);
  const original=await storage.getObjectBuffer({objectKey:sourceKey});
  assert.deepEqual(JSON.parse(original.toString('utf8')),source,'Stored source package must preserve original native evidence');
  assert.deepEqual(state.exportPackage.inspectionChecklistItems,source.inspectionChecklistItems);
  assert.deepEqual(state.exportPackage.utMeasurements,source.utMeasurements);
  assert.deepEqual(state.exportPackage.layoutConfigs,source.layoutConfigs);
  assert.deepEqual(state.exportPackage.elements,source.elements);
  assert.deepEqual(state.exportPackage.findings,source.findings);
  const roundTrip=[];
  for(const object of objects) {
    const {value:read}=await request(`/api/v1/report-jobs/${jobId}/attachments/${encodeURIComponent(object.attachmentId)}/read-url`);
    const r=await fetch(read.readUrl,{signal:AbortSignal.timeout(90000)});assert(r.ok,'Uploaded media read-back failed');
    const bytes=Buffer.from(await r.arrayBuffer());assert.equal(sha(bytes),object.sha256);assert.equal(bytes.length,object.byteSize);
    roundTrip.push({attachmentId:object.attachmentId,relativePath:object.relativePath,sha256:object.sha256,byteSize:bytes.length,readBackVerified:true});
  }
  assert.equal(sha(await readFile(exportPath)),result.sourceSha256);
  await save('imported-state.json',state);
  await save('media-round-trip.json',roundTrip);
  Object.assign(result,{importSuccessful:true,reportJobId:jobId,checklistResponses:195,verifiedObjectCount:objects.length,sourcePackagePreserved:true,sourceBytesUnchanged:true,normalAuthenticatedUploadApi:true,realObjectStorage:true,reportGenerationPerformed:false,asrPerformed:false,uiCapturePerformed:false});
} catch(error) {
  result.error={name:error.name,message:error.message};process.exitCode=1;
} finally {
  if(server&&server.exitCode==null){const done=once(server,'exit');server.kill('SIGTERM');const timer=setTimeout(()=>server.kill('SIGKILL'),5000);await done;clearTimeout(timer);}
  try {
    if(store&&sessionId) {
      const session=await store.getObjectUploadSession({actorUserId:result.authenticatedActorId,uploadSessionId:sessionId});session.objects.forEach(o=>cleanupKeys.add(o.objectKey));
      if(session.finalizedReportJobId){const state=await store.loadReportJobState(session.finalizedReportJobId);if(state?.reportJob?.sourceRevision?.sourceObjectKey)cleanupKeys.add(state.reportJob.sourceRevision.sourceObjectKey);}
    }
    if(cleanupKeys.size)await storage.deleteObjects([...cleanupKeys]);
    if(store)await store.close();
    if(schemaCreated)await client.query(`DROP DATABASE ${schema} WITH (FORCE)`);
    result.cleanupCompleted=true;
  } catch(error) {result.cleanupError=error.message;process.exitCode=1;}
  await client.end();await rm(scratch,{recursive:true,force:true});
  await save('summary.json',result);
}
console.log(JSON.stringify(result,null,2));
