/* Read the credential from stdin. Never logs or persists plaintext credentials. */
require('@next/env').loadEnvConfig(process.cwd());
const {PrismaClient}=require('@prisma/client');const crypto=require('node:crypto');const fs=require('node:fs');const db=new PrismaClient();
async function main(){
 const secret=fs.readFileSync(0,'utf8').trim();if(!secret||secret.length>2000)throw Error('CREDENTIAL_REQUIRED');
 const raw=process.env.TOKEN_ENCRYPTION_KEY||process.env.JWT_SECRET;if(!raw)throw Error('ENCRYPTION_KEY_REQUIRED');
 const key=crypto.createHash('sha256').update('secretbox:'+raw).digest();
 const encrypt=()=>{const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv),data=Buffer.concat([cipher.update(secret,'utf8'),cipher.final()]);return `enc:v1:${iv.toString('base64url')}:${cipher.getAuthTag().toString('base64url')}:${data.toString('base64url')}`;};
 const models=['claude-opus-5.5','gemini-3.1-pro','claude-sonnet-5','gpt-5.6-sol'];
 const actor=await db.user.findFirst({where:{role:{in:['SUPER_ADMIN','ADMIN']}},select:{id:true}});if(!actor)throw Error('ADMIN_REQUIRED');
 await db.$transaction(async tx=>{for(const model of models){const id='vf-codecraft-'+model.replaceAll('.','-'),old=await tx.videoFactoryProvider.findUnique({where:{id}});if(old)await tx.videoFactoryConfigVersion.create({data:{resourceId:id,kind:'PROVIDER',version:old.version,configuration:JSON.stringify({...old,secret:undefined}),actorId:actor.id}});const row={name:'CodeCraft · '+model,kind:'TEXT',adapter:'OPENAI_COMPAT_TEXT',model,enabled:false,secret:encrypt(),credentialRef:null,version:(old?.version||0)+1,health:'UNKNOWN',checkedAt:null,settings:JSON.stringify({baseUrl:'https://codecraftapi.com/v1',maxOutputTokens:6000,commercialApproved:false,safetyReviewed:false,region:'',languages:['fa','en','tr','de'],maxConcurrent:1,requestsPerMinute:10,defaultVoiceId:''}),pricing:JSON.stringify({unitUsd:null,unit:'request',verifiedAt:null})};await tx.videoFactoryProvider.upsert({where:{id},create:{id,...row},update:row});await tx.auditLog.create({data:{actorId:actor.id,action:'video_factory.provider_saved',targetId:id,metadata:JSON.stringify({enabled:false,credentialChanged:true,paidRequests:0})}});}});
 console.log(JSON.stringify({configuredModels:models,encrypted:true,enabled:false,paidRequests:0}));
}main().catch(()=>{console.error('CODECRAFT_DRAFT_REGISTRATION_FAILED');process.exitCode=1}).finally(()=>db.$disconnect());
