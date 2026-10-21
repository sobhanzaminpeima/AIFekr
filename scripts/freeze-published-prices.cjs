/* Freeze retail amounts once from previously recorded rates; never changes historical payments. */
require('@next/env').loadEnvConfig(process.cwd());const {PrismaClient}=require('@prisma/client');const db=new PrismaClient();
(async()=>{const actor=await db.user.findFirst({where:{role:{in:['SUPER_ADMIN','ADMIN']}},select:{id:true}});if(!actor)throw Error('ADMIN_REQUIRED');
 const rows=await db.billingExchangeRate.findMany({where:{source:'USD'},orderBy:{createdAt:'desc'}}),rates={USD:1};
 for(const target of ['IRT','TRY','EUR']){const r=rows.find(r=>r.target===target&&(target!=='IRT'||r.rateType==='FREE_MARKET'&&r.approvedBy));if(r&&Number(r.rate)>0)rates[target]=Number(r.rate);}
 const changed=[];await db.$transaction(async tx=>{
 const offers=await tx.package.findMany({where:{isActive:true,OR:[{publicationStatus:'PUBLISHED'},{category:'VIDEO_FACTORY',publicationStatus:'DRAFT'}]}});
 for(const offer of offers){const entitlements=JSON.parse(offer.entitlements||'{}'),fixedPrices={...entitlements.fixedPrices},terms=JSON.parse(offer.termPrices||'{}');let base=offer.baseCurrency||'USD';
 if(!Object.keys(terms).length){if(offer.priceTry){terms.monthly=offer.priceTry;base='TRY';}else if(offer.priceUsd){terms.monthly=offer.priceUsd;base='USD';}else if(offer.price){terms.monthly=Math.round(offer.price/10);base='IRT';}}
 if(!Object.keys(terms).length)continue;
 for(const [period,minor] of Object.entries(terms)){if(!(minor>0))continue;fixedPrices[base]={...fixedPrices[base],[period]:minor};
  for(const target of ['USD','TRY','IRT','EUR']){if(fixedPrices[target]?.[period]>0||!rates[target]||!rates[base])continue;const major=minor/(base==='IRT'?1:100);const value=Math.ceil(major/rates[base]*rates[target]*(target==='IRT'?1:100));if(Number.isSafeInteger(value)&&value>0&&value<=2147483647)fixedPrices[target]={...fixedPrices[target],[period]:value};}
 }
 await tx.package.update({where:{id:offer.id},data:{entitlements:JSON.stringify({...entitlements,fixedPrices}),...(offer.category==='VIDEO_FACTORY'?{publicationStatus:'PUBLISHED',publicVisible:true}:{})}});
 await tx.auditLog.create({data:{actorId:actor.id,action:'package.fixed_retail_prices',targetId:offer.id,metadata:JSON.stringify({fixedPrices,source:'Previously recorded administrator/provider rate snapshot; fixed retail amounts, not live exchange rates',videoProductionEnabled:false})}});changed.push({planCode:offer.planCode,fixedPrices});
 }});console.log(JSON.stringify({changed,ratesUsed:rates,productionEnabled:false,paidRequests:0}));})().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>db.$disconnect());
