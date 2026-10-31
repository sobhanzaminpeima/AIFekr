// Synthetic data only. Provider calls and billing mutations are intentionally excluded.
require('@next/env').loadEnvConfig(process.cwd());
process.env.DATABASE_URL='file:C:/Claude Projects/AI Chat/ai-platform-voice/prisma/vitest-ui-accounting.db';
const {PrismaClient}=require('@prisma/client'),jwt=require('jsonwebtoken'),assert=require('node:assert/strict');
const db=new PrismaClient(),base='http://localhost:3075';let owner,other,analysis,meeting,site,startup;let passed=0;
function headers(u){return{cookie:'token='+jwt.sign({userId:u.id,role:u.role,plan:u.plan},process.env.JWT_SECRET,{expiresIn:300})}}
async function get(u,path,status=200){const r=await fetch(base+path,{headers:headers(u),signal:AbortSignal.timeout(90000)});assert.equal(r.status,status);passed++;return r}
(async()=>{
 for(const key of ['owner','other']){const u=await db.user.create({data:{email:`advisory-${key}-${Date.now()}@example.test`,passwordHash:'local-only',plan:'BUSINESS',onboardingDone:true}});if(key==='owner')owner=u;else other=u}
 analysis=await db.businessAnalysis.create({data:{userId:owner.id,businessName:'Local fixture',industry:'Local',result:'Local report'}});
 meeting=await db.conversation.create({data:{userId:owner.id,tool:'meeting',title:'Local meeting',model:'auto'}});
 await db.message.create({data:{conversationId:meeting.id,role:'assistant',content:'Local transcript'}});
 site=await db.generatedWebsite.create({data:{userId:owner.id,businessName:'Local site',htmlCode:'<!doctype html><title>Local</title><h1>Fixture</h1>',brief:'{}'}});
 assert.equal((await(await get(owner,'/api/business-doctor?history=1')).json()).analyses.some(a=>a.id===analysis.id),true);passed++;
 assert.equal((await(await get(other,'/api/business-doctor?history=1')).json()).analyses.length,0);passed++;
 assert.equal((await(await get(owner,'/api/meeting/start')).json()).meetings.some(m=>m.id===meeting.id),true);passed++;
 assert.equal((await(await get(other,'/api/meeting/start')).json()).meetings.length,0);passed++;
 await get(other,'/api/chat/history?conversationId='+meeting.id,404);
 const response=await get(owner,'/api/website-designer/'+site.id);assert.match(response.headers.get('content-security-policy'),/sandbox allow-scripts/);assert.match(response.headers.get('cache-control'),/no-store/);passed++;
 await get(other,'/api/website-designer/'+site.id,403);
 const download=await get(owner,'/api/website-designer/'+site.id+'?download=1');assert.match(download.headers.get('content-disposition'),/attachment/);passed++;
 const ref=await(await get(owner,'/api/referral/me')).json();assert.ok(ref.referralCode);assert.equal(ref.invitedCount,0);passed++;
 const qr=await get(owner,'/api/referral/me?qr=1');assert.match(qr.headers.get('content-type'),/image\/svg\+xml/);assert.match(await qr.text(),/<svg/);passed++;
 await get(owner,'/api/wallet/me');
 startup=await db.startupProject.create({data:{userId:owner.id,name:'Local startup',stage:'idea'}});
 await get(other,'/api/startup/'+startup.id,404);await get(owner,'/api/startup/'+startup.id);
 const update=await fetch(base+'/api/startup/'+startup.id,{method:'PUT',headers:{...headers(owner),'content-type':'application/json'},body:JSON.stringify({ideaData:JSON.stringify({inputs:{description:'Local input'},result:'Local analysis'}),stage:'idea'})});assert.equal(update.status,200);passed++;
 const saved=await(await get(owner,'/api/startup/'+startup.id)).json();assert.equal(JSON.parse(saved.project.ideaData).result,'Local analysis');passed++;
 const denied=await fetch(base+'/api/startup/'+startup.id,{method:'PUT',headers:{...headers(other),'content-type':'application/json'},body:JSON.stringify({name:'forbidden'})});assert.equal(denied.status,404);passed++;
 const after=await db.user.findUnique({where:{id:owner.id},select:{credits:true}});assert.equal(after.credits,owner.credits);passed++;
 console.log(JSON.stringify({passed}));
})().catch(e=>{console.log({smoke:'FAILED',error:e.code??e.name,detail:e.message,passed});process.exitCode=1}).finally(async()=>{if(startup)await db.startupProject.deleteMany({where:{id:startup.id}});if(site)await db.generatedWebsite.deleteMany({where:{id:site.id}});if(analysis)await db.businessAnalysis.deleteMany({where:{id:analysis.id}});if(meeting)await db.conversation.deleteMany({where:{id:meeting.id}});for(const u of [owner,other])if(u)await db.user.delete({where:{id:u.id}});await db.$disconnect()});
