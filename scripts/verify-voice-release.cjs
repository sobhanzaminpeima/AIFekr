// Read-only authenticated smoke. Tokens and identities stay in process memory.
require('@next/env').loadEnvConfig(process.cwd());
const {PrismaClient}=require('@prisma/client');
const jwt=require('jsonwebtoken');
const db=new PrismaClient();
(async()=>{const user=await db.user.findFirst({where:{role:{in:['ADMIN','SUPER_ADMIN']},isBlocked:false},select:{id:true,role:true,plan:true}});if(!user)throw Error('NO_AUTHORIZED_ADMIN');
 const token=jwt.sign({userId:user.id,role:user.role,plan:user.plan},process.env.JWT_SECRET,{expiresIn:60,algorithm:'HS256'});
 const headers={cookie:`token=${token}`};
 for(const path of ['/api/voice-studio','/api/admin/voice-studio','/voice-studio','/admin/voice-studio']){const response=await fetch('http://127.0.0.1:3000'+path,{headers,redirect:'manual',signal:AbortSignal.timeout(20000)});let details={};if(path==='/api/voice-studio'){const data=await response.json();details={enabled:data.policy?.enabled,catalogError:data.catalogError};}else if(path==='/api/admin/voice-studio'){const data=await response.json();details={privateStorage:data.privateStorage,configured:data.configured,workerHeartbeat:!!data.workerHeartbeat};}else await response.body?.cancel();console.log({path,status:response.status,...details});}
 const policy=await db.siteSetting.findUnique({where:{key:'voiceStudioSettings'}});console.log({generationEnabled:policy?!!JSON.parse(policy.value).enabled:false});
})().catch(()=>{console.log({smoke:'FAILED'});process.exitCode=1;}).finally(()=>db.$disconnect());
