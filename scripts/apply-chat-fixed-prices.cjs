// Owner-approved bounded configuration update, not a global exchange-rate change.
const fs=require('node:fs'),path=require('node:path');
const {PrismaClient}=require(process.env.PRISMA_RUNTIME_PATH||'@prisma/client');
const catalog=JSON.parse(fs.readFileSync(path.join(__dirname,'../prisma/catalogs/chat-fixed-prices-2026-11-01.json'),'utf8'));
async function main(){
 if(!process.argv.includes('--apply'))throw Error('Take and verify a database backup, then pass --apply');
 if(catalog.plans.length!==3||catalog.plans.some(p=>!['CHAT_ECO_30','CHAT_PLUS_30','CHAT_PRO_30'].includes(p.code)))throw Error('Unexpected catalog');
 const db=new PrismaClient();
 try{await db.$transaction(async tx=>{
  for(const item of catalog.plans){
   const p=await tx.package.findUniqueOrThrow({where:{planCode:item.code}});
   if(p.category!=='CHAT_STARTER'||p.baseCurrency!=='IRT'||p.price!==item.IRT*10||JSON.parse(p.termPrices).monthly!==item.IRT)throw Error('Base price changed: '+item.code);
   const e=JSON.parse(p.entitlements),fixed=e.fixedPrices||{};
   for(const currency of ['USD','TRY'])if(fixed[currency]?.monthly!=null&&fixed[currency].monthly!==item[currency])throw Error('Existing foreign price differs: '+item.code);
   for(const currency of ['IRT','USD','TRY'])fixed[currency]={...(fixed[currency]||{}),monthly:item[currency]};
   e.fixedPrices=fixed;
   await tx.package.update({where:{id:p.id},data:{entitlements:JSON.stringify(e),priceUsd:item.USD,priceTry:item.TRY,market:'BOTH'}});
  }
  await tx.auditLog.create({data:{actorId:'system:owner-approved-pricing',action:'owner_approved_chat_fixed_prices',metadata:JSON.stringify(catalog)}});
 });console.log('THREE_FIXED_CHAT_PRICES_APPLIED');}finally{await db.$disconnect();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
