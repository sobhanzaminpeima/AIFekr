// Only isolated local data. No ads, OAuth, messages or paid calls.
require('@next/env').loadEnvConfig(process.cwd());
process.env.DATABASE_URL='file:C:/Claude Projects/AI Chat/ai-platform-voice/prisma/vitest-ui-accounting.db';
const {PrismaClient}=require('@prisma/client'),jwt=require('jsonwebtoken'),assert=require('node:assert/strict');
const db=new PrismaClient(),base='http://localhost:3075';let owner,other,free,form;const checks=[];
function headers(user){return{cookie:'token='+jwt.sign({userId:user.id,role:user.role,plan:user.plan},process.env.JWT_SECRET,{expiresIn:300}),origin:base,'content-type':'application/json'}}
async function api(user,path,method='GET',body,status=200){const r=await fetch(base+'/api/leadgen/'+path,{method,headers:headers(user),...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(60000)});assert.equal(r.status,status);checks.push({route:path.replace(/cm[a-z0-9]+/g,':id'),status:r.status});return r.json()}
(async()=>{
 const create=plan=>db.user.create({data:{email:`leads-${plan}-${Date.now()}@example.test`,passwordHash:'local-only',plan,onboardingDone:true}});
 owner=await create('BUSINESS');other=await create('BUSINESS');free=await create('FREE');
 await api(free,'forms','GET',null,403);
 for(const p of ['forms','connectors','report'])await api(owner,p);
 form=await api(owner,'forms','POST',{title:'Local contract form'},200);
 await api(other,'forms/'+form.id,'PUT',{title:'forbidden'},404);
 await api(other,'forms/'+form.id+'/submissions','GET',null,404);
 await api(owner,'forms/'+form.id,'PUT',{fields:{email:{show:false,required:true},name:{show:false,required:true}},isActive:false});
 const list=await api(owner,'forms');const saved=list.forms.find(f=>f.id===form.id);assert.equal(saved.fields.name.show,true);assert.equal(saved.fields.email.required,false);assert.equal(saved.isActive,false);
 await api(owner,'forms/'+form.id+'/submissions');
 await api(other,'forms/'+form.id,'DELETE',null,404);
 await api(owner,'forms/'+form.id,'DELETE');form=null;
 const after=await db.user.findUnique({where:{id:owner.id},select:{credits:true}});assert.equal(after.credits,owner.credits);checks.push({route:'unchanged credits',pass:true});
 console.log(JSON.stringify({passed:checks.length,checks}));
})().catch(e=>{console.log({smoke:'FAILED',error:e.code??e.name});process.exitCode=1}).finally(async()=>{if(form)await db.leadForm.deleteMany({where:{id:form.id}});for(const u of [owner,other,free])if(u)await db.user.delete({where:{id:u.id}});await db.$disconnect()});
