/* Bounded real provider + worker + package-credit journey against a new, private test database. */
const fs=require('fs'),path=require('path'),Module=require('module');require('@next/env').loadEnvConfig(process.cwd());
(async()=>{
 if(process.env.AIFEKR_PAID_SMOKE_APPROVED!=='true')throw Error('EXPLICIT_SMOKE_APPROVAL_REQUIRED');
 const {PrismaClient}=require('@prisma/client'),source=new PrismaClient(),vault=await source.siteSetting.findUniqueOrThrow({where:{key:'cloudflarePlatformConfig'}});await source.$disconnect();
 const dir=fs.mkdtempSync('/tmp/aifekr-isolated-video-');fs.chmodSync(dir,0o700);const dbfile=path.join(dir,'test.db');const SQLite=require('better-sqlite3'),sql=new SQLite(dbfile);sql.exec(fs.readFileSync('/tmp/aifekr-smoke-schema.sql','utf8'));sql.close();
 process.env.DATABASE_URL='file:'+dbfile;process.env.VIDEO_FACTORY_STORAGE_DIR=path.join(dir,'media');process.env.VIDEO_FACTORY_SALES_APPROVED='true';
 const original=Module._resolveFilename;Module._resolveFilename=function(name,parent,...rest){return original.call(this,name.startsWith('@/')?path.join(process.cwd(),'src',name.slice(2)):name,parent,...rest);};
 require.extensions['.ts']=function(mod,file){const ts=require('typescript');mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,file);};
 const {prisma}=require('../src/lib/db/prisma.ts'),{policySchema,configurationSchema,quote}=require('../src/lib/video-factory/domain.ts'),{createProject,startProject,getProject,settleJob}=require('../src/lib/video-factory/service.ts'),{processFactoryTick}=require('../src/lib/video-factory/worker.ts');
 try{
 const user=await prisma.user.create({data:{email:'isolated-video-smoke@test.invalid',plan:'PRO',planExpiry:new Date(Date.now()+86400000),credits:10000}}),text='vf-cloudflare-smoke-text',image='vf-cloudflare-smoke-image';
 const policy=policySchema.parse({enabled:true,silentOnly:true,packageRequired:true,approvedModelId:text,approvedTextModelIds:[text],creditsPerChapter:2,creditsPerRenderMinute:2,creditsPerImage:1,providers:{image},presets:{SMART:{videoPercent:0,imagePercent:100}},commercial:{motionModel:text,renderer:'FFMPEG'}});
 await prisma.siteSetting.createMany({data:[{key:vault.key,value:vault.value},{key:'videoFactoryPolicy',value:JSON.stringify(policy)}]});
 for(const [id,kind,adapter,model] of [[text,'TEXT','CLOUDFLARE_TEXT','@cf/meta/llama-3.3-70b-instruct-fp8-fast'],[image,'IMAGE','CLOUDFLARE_IMAGE','@cf/black-forest-labs/flux-1-schnell']])await prisma.videoFactoryProvider.create({data:{id,name:'ISOLATED TEST ONLY',kind,adapter,model,enabled:true,settings:JSON.stringify({commercialApproved:true,safetyReviewed:true,maxOutputTokens:2500}),pricing:JSON.stringify({unitUsd:.001,unit:kind==='TEXT'?'request':'image',verifiedAt:new Date().toISOString()})}});
 await prisma.payment.create({data:{userId:user.id,plan:'TEST_ONLY',status:'SUCCESS',amount:1,entitlementSnapshot:JSON.stringify({category:'VIDEO_FACTORY',credits:10000,days:30,entitlements:{limits:{videoCount:1,videoSeconds:480,videoMaxSeconds:480}}})}});
 const configuration=configurationSchema.parse({durationSeconds:15,language:'en',ratio:'16:9',mode:'AUTOPILOT',quality:'SMART',budgetCap:100,mediaMode:'MULTIMEDIA',shotsPerChapter:1,narration:false,music:false});
 const project=await createProject(user.id,{title:'Isolated Solar System Test',brief:'An educational introduction to the solar system with one concise scene.',configuration}),estimate=quote(configuration,policy),job=await startProject(user.id,project.id,'isolated-live-journey',estimate.credits);
 const reserved=(await prisma.user.findUniqueOrThrow({where:{id:user.id}})).credits;
 for(let i=0;i<12;i++){await processFactoryTick();const state=await prisma.videoFactoryJob.findUniqueOrThrow({where:{id:job.id}});console.log(JSON.stringify({tick:i,stage:state.stage,status:state.status,error:state.errorCode}));if(['DELIVERED','FAILED','CANCELLED'].includes(state.status))break;}
 const result=await getProject(user.id,project.id),done=result.jobs[0],balance=(await prisma.user.findUniqueOrThrow({where:{id:user.id}})).credits;
 if(done.status!=='DELIVERED'||!done.artifacts.some(a=>a.kind==='video')||reserved!==10000-estimate.credits||balance!==reserved)throw Error('ISOLATED_JOURNEY_FAILED '+done.status+' '+done.errorCode);
 const output=path.join(dir,'media',job.id,'film.mp4');if(fs.statSync(output).size<1000)throw Error('VIDEO_FILE_MISSING');
 console.log(JSON.stringify({delivered:true,packageCreditReservationVerified:true,creditsReserved:estimate.credits,creditBalance:balance,artifacts:done.artifacts.map(a=>a.kind),output,productionDatabaseUnchanged:true}));
 // Technical failure refund is tested once with no extra supplier request.
 await prisma.$transaction(tx=>settleJob(tx,job.id,'FAILED','TEST_AFTER_SETTLEMENT'));if((await prisma.user.findUniqueOrThrow({where:{id:user.id}})).credits!==balance)throw Error('SETTLEMENT_NOT_IDEMPOTENT');
 }finally{await prisma.$disconnect();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
