// Local synthetic sites only. No crawler, DNS, Google, WordPress or paid provider request.
require('@next/env').loadEnvConfig(process.cwd());
process.env.DATABASE_URL='file:C:/Claude Projects/AI Chat/ai-platform-voice/prisma/vitest-ui-accounting.db';
const {PrismaClient}=require('@prisma/client'),jwt=require('jsonwebtoken'),assert=require('node:assert/strict');const db=new PrismaClient(),base='http://localhost:3075';let owner,other,site;let passed=0;
function headers(u){return {cookie:'token='+jwt.sign({userId:u.id,role:u.role,plan:u.plan},process.env.JWT_SECRET,{expiresIn:600}),'content-type':'application/json',origin:base}}
async function api(u,path,method='GET',body,status=200){const r=await fetch(base+'/api/seo/'+path,{method,headers:headers(u),...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(90000)});assert.equal(r.status,status);passed++;return r.json()}
(async()=>{
 const create=tag=>db.user.create({data:{email:`seo-${tag}-${Date.now()}@example.test`,passwordHash:'local-only',plan:'BUSINESS',onboardingDone:true}});owner=await create('owner');other=await create('other');
 const made=await api(owner,'sites','POST',{url:'https://local-fixture.example',name:'Local fixture'},201);site=made.site;
 await api(owner,'sites');await api(owner,'intelligence/sites');
 const token=await api(owner,'intelligence/sites','POST',{siteId:site.id});assert.match(token.token,/^aifekr-verification=[a-f0-9]+$/);passed++;
 await api(other,'intelligence/sites','POST',{siteId:site.id},404);
 await api(other,'sites/'+site.id+'/audits','GET',null,404);
 await api(other,'sites/'+site.id+'/content-plan','GET',null,404);
 await api(owner,'sites/'+site.id+'/content-plan','PUT',{enabled:false,theme:'Local theme',topics:['First local topic','Second local topic'],frequency:'weekly',mode:'draft'});
 const saved=await api(owner,'sites/'+site.id+'/content-plan');assert.deepEqual(saved.plan.topics,['First local topic','Second local topic']);assert.equal(saved.plan.enabled,false);passed++;
 await api(owner,'connection');await api(owner,'gsc/status');await api(owner,'agent-pipeline/posts');await api(owner,'agent-pipeline/lessons');await api(owner,'intelligence/research?siteId='+site.id);await api(owner,'intelligence/ranks?siteId='+site.id);
 const after=await db.user.findUnique({where:{id:owner.id},select:{credits:true}});assert.equal(after.credits,owner.credits);passed++;
 console.log(JSON.stringify({passed}));
})().catch(e=>{console.log({test:'FAILED',error:e.code??e.name,detail:e.message,passed});process.exitCode=1}).finally(async()=>{if(site)await db.seoSite.deleteMany({where:{id:site.id}});for(const u of [owner,other])if(u)await db.user.delete({where:{id:u.id}});await db.$disconnect()});
