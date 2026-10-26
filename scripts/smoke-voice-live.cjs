// One explicitly authorized short paid request. Never retry an ambiguous generation.
require('@next/env').loadEnvConfig(process.cwd());
const {PrismaClient}=require('@prisma/client'),jwt=require('jsonwebtoken'),{randomUUID}=require('node:crypto'),fs=require('node:fs');
const db=new PrismaClient(),checkpoint='/var/www/aifekr-maintenance/voice-live-smoke.json';
(async()=>{
 const admin=await db.user.findFirst({where:{role:'SUPER_ADMIN',isBlocked:false},select:{id:true,role:true,plan:true}});if(!admin)throw Error('ADMIN_UNAVAILABLE');
 const headers={cookie:`token=${jwt.sign({userId:admin.id,role:admin.role,plan:admin.plan},process.env.JWT_SECRET,{expiresIn:300})}`,origin:'https://aifekr.com','Content-Type':'application/json'};
 const base='http://127.0.0.1:3000';
 async function post(body){const r=await fetch(base+'/api/voice-studio',{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});const data=await r.json();if(!r.ok)throw Error(data.code||'API_REJECTED');return data;}
 let state=fs.existsSync(checkpoint)?JSON.parse(fs.readFileSync(checkpoint,'utf8')):null;
 if(!state){
  const response=await fetch(base+'/api/voice-studio',{headers,signal:AbortSignal.timeout(20000)}),data=await response.json();
  const model=data.catalog?.models.find(m=>m.id==='eleven_v3'&&m.languages.some(l=>l.id==='fa')&&data.policy.allowedModels.includes(m.id));
  const voice=data.catalog?.voices.find(v=>!data.policy.allowedVoices.length||data.policy.allowedVoices.includes(v.id));
  if(!data.policy.enabled||!model||!voice)throw Error('SMOKE_MODEL_NOT_READY');
  const saved=await post({action:'save',name:'آزمایش واقعی صدای فارسی AIFekr',text:'سلام، به ای‌آی فکر خوش آمدید.',language:'fa'});
  state={projectId:saved.project.id,key:randomUUID(),voiceId:voice.id,modelId:model.id,creditsBefore:data.credits};fs.writeFileSync(checkpoint,JSON.stringify(state),{mode:0o600});
 }
 if(!state.jobId){const created=await post({action:'generate',projectId:state.projectId,segmentIndex:0,voiceId:state.voiceId,modelId:state.modelId,idempotencyKey:state.key,settings:{stability:.5}});state.jobId=created.generation.id;fs.writeFileSync(checkpoint,JSON.stringify(state),{mode:0o600});}
 let row;
 for(let i=0;i<45;i++){row=await db.voiceStudioGeneration.findUniqueOrThrow({where:{id:state.jobId}});if(!['QUEUED','RUNNING'].includes(row.status))break;await new Promise(r=>setTimeout(r,2000));}
 const ledger=await db.usageLog.findMany({where:{OR:[{requestId:`voice:${row.id}:reserve`},{requestId:`voice:${row.id}:refund`}]},select:{credits:true}});
 console.log({status:row.status,code:row.errorCode,durationMs:row.durationMs,reserved:row.reservedCredits,charged:row.chargedCredits,refunded:row.refundedCredits,attempts:row.attempts,netLedgerCredits:ledger.reduce((sum,l)=>sum+l.credits,0),teamPayer:!!row.payerTeamId});
 if(row.status!=='READY')return;
 const replay=await post({action:'generate',projectId:state.projectId,segmentIndex:0,voiceId:state.voiceId,modelId:state.modelId,idempotencyKey:state.key,settings:{stability:.5}});console.log({idempotency:replay.generation.id===row.id});
 const download=await fetch(base+'/api/voice-studio?audio='+row.id,{headers,redirect:'manual',signal:AbortSignal.timeout(20000)});const signed=download.headers.get('location');if(!signed)throw Error('DOWNLOAD_FAILED');
 const audio=await fetch(signed,{headers:{range:'bytes=0-255',origin:'https://aifekr.com'},signal:AbortSignal.timeout(20000)});const bytes=Buffer.from(await audio.arrayBuffer());
 const unsigned=new URL(signed);unsigned.search='';const denied=await fetch(unsigned,{signal:AbortSignal.timeout(20000)});await denied.body?.cancel();
 const after=await fetch(base+'/api/voice-studio',{headers,signal:AbortSignal.timeout(20000)});const current=await after.json();
 console.log({authenticatedDownload:download.status,audioHttp:audio.status,audioType:audio.headers.get('content-type'),rangeBytes:bytes.length,unsignedHttp:denied.status,creditsDebited:state.creditsBefore-current.credits,projectUrl:'https://aifekr.com/voice-studio?project='+state.projectId});
})().catch(error=>{console.log({smoke:'FAILED',code:/^[A-Z_]{1,80}$/.test(error.message)?error.message:'CHECK_SERVER_STATE_NO_AUTO_RETRY'});process.exitCode=1;}).finally(()=>db.$disconnect());
