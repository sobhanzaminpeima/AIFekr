/* Link existing encrypted CodeCraft credentials; no plaintext copy and no API requests. */
require('@next/env').loadEnvConfig(process.cwd());const {PrismaClient}=require('@prisma/client');const db=new PrismaClient();
(async()=>{const actor=await db.user.findFirst({where:{role:{in:['SUPER_ADMIN','ADMIN']}},select:{id:true}});if(!actor)throw Error('ADMIN_REQUIRED');const registered=[];
 await db.$transaction(async tx=>{const providers=await tx.videoFactoryProvider.findMany({where:{id:{startsWith:'vf-codecraft-'},kind:'TEXT'}});for(const p of providers){
  const id='llm-'+p.id,baseUrl=JSON.parse(p.settings).baseUrl,existing=await tx.customAiProvider.findUnique({where:{id}});
  if(!existing)await tx.customAiProvider.create({data:{id,name:p.name,type:'chat',baseUrl,model:p.model,apiKey:'vf-ref:'+p.id,enabled:false}});
  await tx.auditLog.create({data:{actorId:actor.id,action:'llm.provider_linked',targetId:id,metadata:JSON.stringify({providerId:p.id,encryptedVaultReference:true,created:!existing,paidRequests:0})}});registered.push({model:p.model,enabled:existing?.enabled??false});
 }});console.log(JSON.stringify({llmManagerModels:registered,plaintextCredentialCopies:0,paidRequests:0}));})().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>db.$disconnect());
