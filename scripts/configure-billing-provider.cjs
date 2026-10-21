const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
require('@next/env').loadEnvConfig(process.cwd());
const {PrismaClient}=require('@prisma/client');
const prisma=new PrismaClient();
async function main(){
 const input=JSON.parse(fs.readFileSync(0,'utf8'));
 if(typeof input.apiKey!=='string'||!input.apiKey||typeof input.freeMarketRate!=='string'||!/^\d+(\.\d{1,8})?$/.test(input.freeMarketRate)||Number(input.freeMarketRate)<=0||typeof input.source!=='string'||!input.source.startsWith('https://'))throw Error('Valid operator-supplied credentials, rate and source required');
 const filename=path.resolve('src/lib/crypto/secretBox.ts');
 const compiled=require('typescript').transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:require('typescript').ModuleKind.CommonJS}}).outputText;
 const secret=new Module(filename,module);secret.filename=filename;secret.paths=module.paths;secret._compile(compiled,filename);
 const apiKey=secret.exports.encryptSecret(input.apiKey),actorId='system:authorized-currency-setup';
 await prisma.$transaction(async tx=>{
  const value=JSON.stringify({enabled:true,apiKey,accountId:input.accountId||'',authMode:'BEARER'});
  await tx.siteSetting.upsert({where:{key:'billing_xe_config'},create:{key:'billing_xe_config',value},update:{value}});
  await tx.siteSetting.deleteMany({where:{key:'billing_xe_health'}});
  const rate=await tx.billingExchangeRate.create({data:{target:'IRT',rate:input.freeMarketRate,provider:input.source+' · '+input.quotedAt,rateType:'FREE_MARKET',approvedBy:actorId,validUntil:new Date(Date.now()+24*3600000)}});
  await tx.auditLog.create({data:{actorId,action:'billing_rate_approved',targetId:rate.id,metadata:JSON.stringify({source:input.source,quotedAt:input.quotedAt,rate:input.freeMarketRate,authorization:'User requested current-market pricing in Codex'})}});
 });
 console.log('Encrypted XE configuration and approved free-market IRT rate stored.');
}
main().catch(()=>{console.error('Billing configuration failed; no credentials logged.');process.exitCode=1;}).finally(()=>prisma.$disconnect());
