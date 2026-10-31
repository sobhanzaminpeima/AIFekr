// Run against a read-only deployment database before switching the app process.
const {PrismaClient}=require('@prisma/client');
if(!process.env.DATABASE_URL?.includes('mode=ro'))throw Error('READ_ONLY_DATABASE_REQUIRED');
const prisma=new PrismaClient();
(async()=>{
 for(const model of ['growthProfile','growthEvent','moduleRegistry','businessAnalysis','startupProject','generatedWebsite','leadForm','walletPayoutRequest']){
  if(typeof prisma[model]?.count!=='function')throw Error('PRISMA_MODEL_UNAVAILABLE:'+model);
  await prisma[model].count();
 }
 console.log('UI_PRISMA_RUNTIME_OK');
})().catch(()=>{console.error('UI_PRISMA_RUNTIME_CHECK_FAILED');process.exitCode=1}).finally(()=>prisma.$disconnect());
