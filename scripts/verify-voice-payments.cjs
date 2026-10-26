require('@next/env').loadEnvConfig(process.cwd());
const {PrismaClient}=require('@prisma/client'),jwt=require('jsonwebtoken');const db=new PrismaClient();
(async()=>{
 const admin=await db.user.findFirst({where:{role:{in:['ADMIN','SUPER_ADMIN']},isBlocked:false},select:{id:true,role:true,plan:true}});if(!admin)throw Error('ADMIN_UNAVAILABLE');
 const token=jwt.sign({userId:admin.id,role:admin.role,plan:admin.plan},process.env.JWT_SECRET,{expiresIn:120});
 const headers={cookie:`token=${token}`,origin:'https://aifekr.com','Content-Type':'application/json'};
 const base='http://127.0.0.1:3000';
 const settings=await fetch(base+'/api/admin/voice-studio',{headers,signal:AbortSignal.timeout(20000)});const data=await settings.json();
 console.log({adminRead:settings.status,privateStorage:data.privateStorage,enabled:data.settings?.enabled,worker:!!data.workerHeartbeat});
 const test=await fetch(base+'/api/admin/voice-studio',{method:'POST',headers,body:JSON.stringify({action:'test'}),signal:AbortSignal.timeout(35000)});const result=await test.json();console.log({connectionTest:test.status,code:result.code||null,models:result.models?.length,voices:result.voices?.length});
 // Activation still goes through the real preflight; never writes an unconditional database flag.
 const activate=await fetch(base+'/api/admin/voice-studio',{method:'POST',headers,body:JSON.stringify({action:'settings',settings:{...data.settings,enabled:true}}),signal:AbortSignal.timeout(35000)});const activated=await activate.json();console.log({activationHttp:activate.status,code:activated.code||null,enabled:activated.settings?.enabled??false});
 const financial=await fetch(base+'/admin/financial?status=PENDING',{headers,signal:AbortSignal.timeout(20000)});const html=await financial.text();console.log({financial:financial.status,cancelActionPresent:html.includes('Cancel order')||html.includes('لغو کامل سفارش'),continueActionPresent:html.includes('Get payment continuation link')||html.includes('لینک ادامهٔ پرداخت')});
 const cancelled=await fetch(base+'/admin/financial?status=CANCELLED',{headers,signal:AbortSignal.timeout(20000)});await cancelled.body?.cancel();console.log({cancelledFilter:cancelled.status});
})().catch(()=>{console.log({verification:'FAILED'});process.exitCode=1;}).finally(()=>db.$disconnect());
