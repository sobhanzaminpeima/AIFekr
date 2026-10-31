require('@next/env').loadEnvConfig(process.cwd());process.env.DATABASE_URL='file:C:/Claude Projects/AI Chat/ai-platform-voice/prisma/vitest-ui-accounting.db';
const {PrismaClient}=require('@prisma/client'),jwt=require('jsonwebtoken'),assert=require('node:assert/strict');const db=new PrismaClient(),base='http://localhost:3075';let owner,other,organizationId,businessId;let passed=0;
function headers(u){return{cookie:'token='+jwt.sign({userId:u.id,role:u.role,plan:u.plan},process.env.JWT_SECRET,{expiresIn:600}),origin:base,'content-type':'application/json'}}
async function api(u,path,method='GET',body,status=200){const r=await fetch(base+'/api/'+path,{method,headers:headers(u),...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(90000)});assert.equal(r.status,status);passed++;return r.json()}
(async()=>{
 const make=tag=>db.user.create({data:{email:`org-ui-${tag}-${Date.now()}@example.test`,passwordHash:'local-only',plan:'BUSINESS',onboardingDone:true}});owner=await make('owner');other=await make('other');
 await api(owner,'organizations','POST',{organizationName:'Local organization',businessName:'Local business',timezone:'UTC',currency:'USD'},201);
 const list=await api(owner,'organizations');const entry=list.organizations[0];organizationId=entry.organization.id;businessId=entry.businesses[0].id;
 const view=await api(owner,'organizations/workspace?businessId='+businessId);assert.equal(view.business.id,businessId);assert.equal(view.canManageTeam,true);assert.ok(view.permissions.includes('team.manage'));passed++;
 await api(other,'organizations/workspace?businessId='+businessId,'GET',null,403);await api(other,'organizations/context','PATCH',{businessId},403);
 const member=await db.organizationMember.create({data:{organizationId,userId:other.id,role:'VIEWER',allBusinesses:false}});await db.businessMember.create({data:{businessId,organizationMemberId:member.id,userId:other.id,role:'VIEWER'}});
 const limited=await api(other,'organizations/workspace?businessId='+businessId);assert.equal(limited.canManageTeam,false);assert.equal(limited.members.length,0);assert.equal(limited.audits.length,0);assert.ok(!limited.permissions.includes('team.manage'));passed++;
 await api(other,'organizations/'+organizationId+'/businesses','POST',{name:'Forbidden'},403);
 const balance=await db.user.findUnique({where:{id:owner.id},select:{credits:true}});assert.equal(balance.credits,owner.credits);passed++;
 console.log(JSON.stringify({passed}));
})().catch(e=>{console.log({test:'FAILED',error:e.code??e.name,detail:e.message,passed});process.exitCode=1}).finally(async()=>{for(const u of [owner,other])if(u)await db.user.updateMany({where:{id:u.id},data:{activeBusinessId:null}});if(organizationId)await db.organization.deleteMany({where:{id:organizationId}});for(const u of [owner,other])if(u)await db.user.delete({where:{id:u.id}});await db.$disconnect()});
