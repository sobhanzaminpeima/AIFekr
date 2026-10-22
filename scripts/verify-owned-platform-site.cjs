require('@next/env').loadEnvConfig(process.cwd());
const {PrismaClient}=require('@prisma/client');
const {mkdir,writeFile}=require('node:fs/promises');
const {randomBytes}=require('node:crypto');
const db=new PrismaClient();
(async()=>{
 const sites=await db.seoSite.findMany({where:{archivedAt:null,user:{role:'SUPER_ADMIN'},url:{in:['https://aifekr.com','https://aifekr.com/']}}});
 if(sites.length!==1)throw Error('Exactly one owner site required');
 const site=sites[0],token=site.verificationToken||randomBytes(24).toString('hex');
 await db.seoSite.update({where:{id:site.id},data:{verificationToken:token}});
 await mkdir('public/.well-known',{recursive:true});
 await writeFile('public/.well-known/aifekr-verification.txt',`aifekr-verification=${token}`);
 const response=await fetch('https://aifekr.com/.well-known/aifekr-verification.txt',{cache:'no-store'});
 if(!response.ok||(await response.text()).trim()!==`aifekr-verification=${token}`)throw Error('Public ownership file not reachable');
 await db.seoSite.update({where:{id:site.id},data:{verifiedAt:new Date()}});
 console.log('OWNER_SITE_VERIFIED');
})().finally(()=>db.$disconnect());
