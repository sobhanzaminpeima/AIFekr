import {prisma} from "@/lib/db/prisma";
import {getPolicy} from "./config";
import {productionCost} from "./costing";
import {videoLimitsSchema} from "./packages";
import {FactoryError} from "./errors";
export async function repriceVideoDrafts(actorId:string){
 const {commercial}=await getPolicy();if(!commercial.rateCard)throw new FactoryError("RATE_CARD_REQUIRED",400);
 return prisma.$transaction(async tx=>{
  const drafts=await tx.package.findMany({where:{category:"VIDEO_FACTORY",publicationStatus:"DRAFT",baseCurrency:"USD"}}),updated=[];
  for(const offer of drafts){
   // Payment entitlements and historical offers must remain stable.
   if(await tx.payment.count({where:{plan:offer.planCode,status:"SUCCESS"}}))continue;
   const limits=videoLimitsSchema.parse(JSON.parse(offer.entitlements).limits),cost=productionCost(commercial.rateCard!,limits.videoSeconds/60);
   const floor=Math.ceil((cost.minimumSaleCents+1)/1000)*1000-1;
   const priceUsd=Math.max(offer.priceUsd||0,floor);
   await tx.package.update({where:{id:offer.id},data:{priceUsd,price:0,priceTry:null,termPrices:JSON.stringify({monthly:priceUsd}),credits:Math.max(offer.credits,priceUsd),publicVisible:false}});
   await tx.auditLog.create({data:{actorId,action:"video_factory.draft_repriced",targetId:offer.id,metadata:JSON.stringify({previousPriceUsd:offer.priceUsd,priceUsd,minimumSaleCents:cost.minimumSaleCents,rateDate:commercial.rateCard!.checkedAt})}});
   updated.push({planCode:offer.planCode,priceUsd,...productionCost(commercial.rateCard!,limits.videoSeconds/60,priceUsd)});
  }return updated;
 });
}
