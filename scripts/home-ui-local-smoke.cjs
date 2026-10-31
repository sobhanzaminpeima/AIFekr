require('@next/env').loadEnvConfig(process.cwd());
process.env.DATABASE_URL='file:C:/Claude Projects/AI Chat/ai-platform-voice/prisma/vitest-ui-accounting.db';
const {PrismaClient}=require('@prisma/client'),jwt=require('jsonwebtoken'),assert=require('node:assert/strict');
const db=new PrismaClient();let user;const results=[];
(async()=>{
 user=await db.user.create({data:{email:`home-local-${Date.now()}@example.test`,passwordHash:'local-only',plan:'BUSINESS',onboardingDone:true}});
 const token=jwt.sign({userId:user.id,role:user.role,plan:user.plan},process.env.JWT_SECRET,{expiresIn:600});
 for(const lang of ['fa','en','de','tr']) {
  const headers={cookie:`token=${token}; lang=${lang}`,'x-ui-lang':lang,'x-aifekr-path':'/home'};
  const shell=await fetch('http://localhost:3075/api/app/shell?path=/home',{headers,signal:AbortSignal.timeout(120000)});assert.equal(shell.status,200);const data=await shell.json();assert.equal(data.lang,lang);assert.ok(data.personal);assert.ok(data.user);
  const page=await fetch('http://127.0.0.1:3101/home',{headers,signal:AbortSignal.timeout(120000)});const html=await page.text();assert.equal(page.status,200);assert.ok(!html.includes('این بار صفحه آماده نشد'));assert.ok(!html.includes('App frame unavailable'));
  results.push({lang,shell:shell.status,page:page.status});
 }
 console.log(JSON.stringify({passed:results.length,results}));
})().catch(e=>{console.log({test:'FAILED',error:e.code??e.name,detail:e.message});process.exitCode=1}).finally(async()=>{if(user){await db.growthEvent.deleteMany({where:{userId:user.id}});await db.growthTouch.deleteMany({where:{userId:user.id}});await db.growthProfile.deleteMany({where:{userId:user.id}});await db.user.delete({where:{id:user.id}})}await db.$disconnect()});
