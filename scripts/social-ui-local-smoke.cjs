// Isolated local contract checks. No connected account, external sends or paid generation.
require('@next/env').loadEnvConfig(process.cwd());
process.env.DATABASE_URL='file:C:/Claude Projects/AI Chat/ai-platform-voice/prisma/vitest-ui-accounting.db';
const {PrismaClient}=require('@prisma/client'),jwt=require('jsonwebtoken');
const db=new PrismaClient(),base='http://localhost:3075';
let user; const checks=[];
(async()=>{
 user=await db.user.create({data:{email:`social-ui-${Date.now()}@example.test`,passwordHash:'local-only',plan:'BUSINESS',onboardingDone:true}});
 const headers={cookie:'token='+jwt.sign({userId:user.id,role:user.role,plan:user.plan},process.env.JWT_SECRET,{expiresIn:300}),origin:base,'content-type':'application/json'};
 for(const path of ['instagram/status','brand-profile','instagram/campaigns','instagram/direct-rules','competitors']){
  const r=await fetch(base+'/api/social/'+path,{headers,signal:AbortSignal.timeout(60000)});const d=await r.json();
  checks.push({route:path,status:r.status,pass:r.ok&&(path!=='instagram/status'||d.connected===false)});
 }
 const invalid=await fetch(base+'/api/social/instagram/studio',{method:'POST',headers,body:JSON.stringify({task:'caption',brief:'',language:'fa'})});
 checks.push({route:'invalid brief',status:invalid.status,pass:invalid.status===400});
 const status=await fetch(base+'/api/social/instagram/analytics',{headers});
 checks.push({route:'no-account analytics',status:status.status,pass:status.status===400});
 const after=await db.user.findUnique({where:{id:user.id},select:{credits:true}});
 checks.push({route:'no charge',pass:after.credits===user.credits});
 console.log(JSON.stringify(checks)); if(checks.some(c=>!c.pass))process.exitCode=1;
})().catch(()=>{console.log({smoke:'FAILED'});process.exitCode=1;}).finally(async()=>{if(user)await db.user.delete({where:{id:user.id}});await db.$disconnect();});
