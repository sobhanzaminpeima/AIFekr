import {settleMarketOrder} from "@/lib/fitness/marketplace";
import {grantReferralRewardInTransaction} from "@/lib/utils/referralWallet";
import { isBusinessBundle, businessIncludesVoice } from "@/lib/plans/business";
import {standaloneVoiceExpiry} from "./voiceEntitlement";
import { prisma } from "@/lib/db/prisma";
export async function reviewBankPayment(id:string,adminId:string,approve:boolean,note:string){
 return settlePayment(id,{adminId,approve,note});
}
export async function settleVerifiedPayment(id:string,authority:string,refId:string){
 return settlePayment(id,{authority,refId,approve:true});
}
async function settlePayment(id:string,review:{adminId?:string;approve:boolean;note?:string;authority?:string;refId?:string}){
 const {adminId,approve,note}=review;
 return prisma.$transaction(async tx=>{
 const p=await tx.payment.findUnique({where:{id},include:{user:true}});
 if(!p)throw new Error("NOT_REVIEWABLE");
 if(review.authority){if(p.gateway!=="zarinpal"||p.authority!==review.authority)throw new Error("NOT_REVIEWABLE");}
 else if(p.gateway!=="bank_transfer"||!p.receiptAt)throw new Error("NOT_REVIEWABLE");
 const claimed=await tx.payment.updateMany({where:{id,status:"PENDING"},data:{status:approve?"SUCCESS":"REJECTED",reviewBy:adminId,reviewAt:adminId?new Date():undefined,reviewNote:note,refId:approve?(review.refId||`BANK-${id}`):null}});
 if(!claimed.count){if(review.authority&&p.status==="SUCCESS")return false;throw new Error("ALREADY_REVIEWED");}
 if(p.plan==="FIT_MARKETPLACE"){await settleMarketOrder(tx,p.id,approve);if(approve&&p.user.referredBy&&p.user.referredBy!==p.userId)await grantReferralRewardInTransaction(tx,p.userId,p.user.referredBy,100,p.amount,p.id);return true;}
 if(!approve){const reserved=await tx.billingPromotionRedemption.findUnique({where:{paymentId:id}});if(reserved){await tx.billingPromotionRedemption.delete({where:{paymentId:id}});await tx.auditLog.create({data:{actorId:adminId||p.userId,action:"billing_promotion_reservation_released",targetId:id,metadata:JSON.stringify({promotionId:reserved.promotionId,reason:"REJECTED"})}});}return;}
 const entitlement=JSON.parse(p.entitlementSnapshot) as {credits:number;days:number;teamSeatLimit?:number;crmSeatLimit?:number;businessBundle?:boolean;category?:string;mediaCredits?:number;voiceMinutes?:number;entitlements?:{modules?:string[]};quote?:{bonus?:{id:string;days:number;credits:number}|null}};
 if(!Number.isInteger(entitlement.credits)||entitlement.credits<0||!Number.isFinite(entitlement.days)||entitlement.days<=0)throw new Error("INVALID_ENTITLEMENT");
 const u=p.user;
 if(entitlement.quote?.bonus){const bonus=entitlement.quote.bonus;const reservation=await tx.billingPromotionRedemption.findUniqueOrThrow({where:{paymentId:p.id}});if(reservation.userId!==u.id||reservation.promotionId!==bonus.id)throw Error("INVALID_PROMOTION_RESERVATION");entitlement.days+=bonus.days;entitlement.credits+=bonus.credits;}

 if(entitlement.category==="VIDEO_FACTORY"){
 const {videoLimitsSchema}=await import("@/lib/video-factory/packages");videoLimitsSchema.parse((entitlement.entitlements as {limits?:unknown})?.limits);
 await tx.user.update({where:{id:u.id},data:{trialLimited:false,credits:{increment:entitlement.credits},aiCredits:{increment:entitlement.credits}}});
 await tx.userModuleOverride.upsert({where:{userId_moduleKey:{userId:u.id,moduleKey:"video-factory"}},create:{userId:u.id,moduleKey:"video-factory",enabled:true},update:{enabled:true}});
 await tx.auditLog.create({data:{actorId:adminId||u.id,action:"video_factory.package_granted",targetId:p.id,metadata:JSON.stringify({credits:entitlement.credits,days:entitlement.days})}});
 }else if(entitlement.category==="FITNESS"){
 const profile=await tx.fitnessProfile.findUnique({where:{userId:u.id}});if(!profile)throw Error("FITNESS_ONBOARDING_REQUIRED");const expires=new Date(Math.max(Date.now(),profile.entitlementExpiry?.getTime()||0)+entitlement.days*86400000);await tx.fitnessProfile.update({where:{userId:u.id},data:{entitlementExpiry:expires}});await tx.user.update({where:{id:u.id},data:{credits:{increment:entitlement.credits},aiCredits:{increment:entitlement.credits},mediaCredits:{increment:entitlement.mediaCredits||0},voiceMinutes:{increment:entitlement.voiceMinutes||0}}});await tx.auditLog.create({data:{actorId:adminId||u.id,action:"fitness_subscription_activated",targetId:u.id,metadata:JSON.stringify({paymentId:p.id,expires})}});
 }else{
 if(entitlement.mediaCredits||entitlement.voiceMinutes)await tx.user.update({where:{id:u.id},data:{mediaCredits:{increment:entitlement.mediaCredits||0},voiceMinutes:{increment:entitlement.voiceMinutes||0}}});
 for(const key of entitlement.entitlements?.modules||[]){if(key==="fitness.workspace")continue;await tx.userModuleOverride.upsert({where:{userId_moduleKey:{userId:u.id,moduleKey:key}},create:{userId:u.id,moduleKey:key,enabled:true},update:{enabled:true}});}
 const bundle=isBusinessBundle(p.plan)&&entitlement.businessBundle===true;
 const oldExpiry=p.plan.startsWith("CRM_")?u.crmPlanExpiry:p.plan.startsWith("VOICE_")?u.voicePlanExpiry:u.planExpiry;
 const expiry=new Date(Math.max(Date.now(),oldExpiry?.getTime()||0)+entitlement.days*86400000);
 if(p.plan.startsWith("CREDITS_"))await tx.user.update({where:{id:u.id},data:{credits:{increment:entitlement.credits}}});
 else if(p.plan.startsWith("VOICE_"))await tx.user.update({where:{id:u.id},data:{voicePlan:"ACTIVE",voicePlanExpiry:expiry}});
 else {
 const separateVoice=bundle&&!businessIncludesVoice(p.plan)?await standaloneVoiceExpiry(tx,u.id):null;
 const crm=p.plan.startsWith("CRM_"),team=p.plan==="TEAM"||p.plan.startsWith("TEAM_")||p.plan==="CRM_TEAM";
 await tx.user.update({where:{id:u.id},data:crm?{crmPlan:p.plan==="CRM_TEAM"?"TEAM":"SOLO",crmPlanExpiry:expiry}:{plan:team?"TEAM":p.plan,...(p.plan.startsWith("STUDENT_")?{accountType:"STUDENT"}:bundle?{accountType:"BUSINESS"}:{}),planExpiry:expiry,trialLimited:false,...(bundle?{crmPlan:"TEAM",crmPlanExpiry:expiry,...(businessIncludesVoice(p.plan)?{voicePlan:"ACTIVE",voicePlanExpiry:expiry}:separateVoice&&u.voicePlan==="ACTIVE"?{voicePlan:"ACTIVE",voicePlanExpiry:separateVoice}:{voicePlan:"NONE",voicePlanExpiry:null})}:{}),...(!team?{credits:{increment:entitlement.credits}}:{})}});
 if(team){
 const seats=crm?entitlement.crmSeatLimit||5:entitlement.teamSeatLimit||5;
 const existing=await tx.team.findUnique({where:{ownerId:u.id}});
 if(bundle&&existing&&await tx.teamMember.count({where:{teamId:existing.id}})>seats)throw new Error("TEAM_CAPACITY_EXCEEDED");
 const row=existing?await tx.team.update({where:{id:existing.id},data:{maxSeats:bundle?seats:Math.max(existing.maxSeats,seats),...(!crm?{credits:{increment:entitlement.credits},planExpiry:expiry}:{})}}):await tx.team.create({data:{ownerId:u.id,name:`Team ${u.name||"AIFekr"}`,maxSeats:seats,credits:crm?0:entitlement.credits,...(!crm?{planExpiry:expiry}:{})}});
 await tx.teamMember.upsert({where:{userId:u.id},create:{teamId:row.id,userId:u.id,role:"OWNER",...((crm||bundle)?{crmRole:"OWNER"}:{})},update:{...((crm||bundle)?{crmRole:"OWNER"}:{})}});
 }
 if(p.plan.startsWith("STUDENT_")){const education=await tx.industryPack.findUnique({where:{slug:"university"},select:{id:true}});if(!education)throw new Error("STUDENT_INDUSTRY_NOT_CONFIGURED");await tx.user.update({where:{id:u.id},data:{industryPackId:education.id}});await tx.userModuleOverride.upsert({where:{userId_moduleKey:{userId:u.id,moduleKey:"student.workspace"}},create:{userId:u.id,moduleKey:"student.workspace",enabled:true},update:{enabled:true}});}
 }
 }
 if(p.walletDiscountToman>0){await tx.user.update({where:{id:u.id},data:{walletBalance:{decrement:p.walletDiscountToman}}});await tx.walletTransaction.create({data:{userId:u.id,type:"redeem_at_checkout",amount:-p.walletDiscountToman,relatedPaymentId:p.id}});}
 if(u.referredBy&&u.referredBy!==u.id)await grantReferralRewardInTransaction(tx,u.id,u.referredBy,100,p.amount,p.id);
 return true;
 });
}
