// Run against a read-only deployment database before switching the app process.
// Validate the same import resolution as the deployed route, not this script's folder.
const {createRequire}=require('node:module');
const path=require('node:path');
if(!process.env.UI_DEPLOY_DIST||!path.isAbsolute(process.env.UI_DEPLOY_DIST))throw Error('ABSOLUTE_DEPLOY_DIST_REQUIRED');
const deployedRequire=createRequire(path.join(process.env.UI_DEPLOY_DIST,'server/app/api/app/shell/route.js'));
const {PrismaClient}=deployedRequire('@prisma/client');
if(!process.env.DATABASE_URL?.includes('mode=ro'))throw Error('READ_ONLY_DATABASE_REQUIRED');
const prisma=new PrismaClient();
(async()=>{
 for(const model of ['growthProfile','growthEvent','moduleRegistry','businessAnalysis','startupProject','generatedWebsite','leadForm','walletPayoutRequest']){
  if(typeof prisma[model]?.count!=='function')throw Error('PRISMA_MODEL_UNAVAILABLE:'+model);
  await prisma[model].count();
 }
 console.log('UI_PRISMA_RUNTIME_OK');
})().catch(()=>{console.error('UI_PRISMA_RUNTIME_CHECK_FAILED');process.exitCode=1}).finally(()=>prisma.$disconnect());
