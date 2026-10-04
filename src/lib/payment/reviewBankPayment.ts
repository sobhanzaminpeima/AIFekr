import { isBusinessBundle } from "@/lib/plans/business";
import { prisma } from "@/lib/db/prisma";
export async function reviewBankPayment(id:string,adminId:string,approve:boolean,note:string){
 return prisma.$transaction(async tx=>{
 const p=await tx.payment.findUnique({where:{id},include:{user:true}});
 if(!p||p.gateway!=="bank_transfer"||!p.receiptAt)throw new Error("NOT_REVIEWABLE");
 const claimed=await tx.payment.updateMany({where:{id,status:"PENDING"},data:{status:approve?"SUCCESS":"REJECTED",reviewBy:adminId,reviewAt:new Date(),reviewNote:note,refId:approve?`BANK-${id}`:null}});
 if(!claimed.count)throw new Error("ALREADY_REVIEWED");
 if(!approve)return;
 const entitlement=JSON.parse(p.entitlementSnapshot) as {credits:number;days:number;teamSeatLimit?:number;crmSeatLimit?:number;businessBundle?:boolean};
 if(!Number.isInteger(entitlement.credits)||entitlement.credits<0||!Number.isFinite(entitlement.days)||entitlement.days<=0)throw new Error("INVALID_ENTITLEMENT");
 const u=p.user;
 const bundle=isBusinessBundle(p.plan)&&entitlement.businessBundle===true;
 const oldExpiry=p.plan.startsWith("CRM_")?u.crmPlanExpiry:p.plan.startsWith("VOICE_")?u.voicePlanExpiry:u.planExpiry;
 const expiry=new Date(Math.max(Date.now(),oldExpiry?.getTime()||0)+entitlement.days*86400000);
 if(p.plan.startsWith("CREDITS_"))await tx.user.update({where:{id:u.id},data:{credits:{increment:entitlement.credits}}});
 else if(p.plan.startsWith("VOICE_"))await tx.user.update({where:{id:u.id},data:{voicePlan:"ACTIVE",voicePlanExpiry:expiry}});
 else {
 const crm=p.plan.startsWith("CRM_"),team=p.plan==="TEAM"||p.plan.startsWith("TEAM_")||p.plan==="CRM_TEAM";
 await tx.user.update({where:{id:u.id},data:crm?{crmPlan:p.plan==="CRM_TEAM"?"TEAM":"SOLO",crmPlanExpiry:expiry}:{plan:team?"TEAM":p.plan,...(p.plan.startsWith("STUDENT_")?{accountType:"STUDENT"}:bundle?{accountType:"BUSINESS"}:{}),planExpiry:expiry,trialLimited:false,...(bundle?{crmPlan:"TEAM",crmPlanExpiry:expiry,voicePlan:"ACTIVE",voicePlanExpiry:expiry}:{}),...(!team?{credits:{increment:entitlement.credits}}:{})}});
 if(team){
 const seats=crm?entitlement.crmSeatLimit||5:entitlement.teamSeatLimit||5;
 const existing=await tx.team.findUnique({where:{ownerId:u.id}});
 if(bundle&&existing&&await tx.teamMember.count({where:{teamId:existing.id}})>seats)throw new Error("TEAM_CAPACITY_EXCEEDED");
 const row=existing?await tx.team.update({where:{id:existing.id},data:{maxSeats:bundle?seats:Math.max(existing.maxSeats,seats),...(!crm?{credits:{increment:entitlement.credits},planExpiry:expiry}:{})}}):await tx.team.create({data:{ownerId:u.id,name:`Team ${u.name||"AIFekr"}`,maxSeats:seats,credits:crm?0:entitlement.credits,...(!crm?{planExpiry:expiry}:{})}});
 await tx.teamMember.upsert({where:{userId:u.id},create:{teamId:row.id,userId:u.id,role:"OWNER",...((crm||bundle)?{crmRole:"OWNER"}:{})},update:{...((crm||bundle)?{crmRole:"OWNER"}:{})}});
 }
 if(p.plan.startsWith("STUDENT_"))await tx.userModuleOverride.upsert({where:{userId_moduleKey:{userId:u.id,moduleKey:"student.workspace"}},create:{userId:u.id,moduleKey:"student.workspace",enabled:true},update:{enabled:true}});
 }
 if(u.referredBy&&!u.referralRewarded&&u.referredBy!==u.id){
 const referrer=await tx.user.findUnique({where:{id:u.referredBy}});
 if(referrer){
 const setting=await tx.siteSetting.findUnique({where:{key:"referral_commission_percent"}});
 const configured=Number(setting?.value??15),percent=referrer.commissionPercentOverride??configured;
 if(!Number.isFinite(percent)||percent<0||percent>100)throw new Error("INVALID_COMMISSION");
 const commission=Math.round(p.amount*percent/100);
 // Claim the first-purchase reward inside the same transaction as activation.
 const first=await tx.user.updateMany({where:{id:u.id,referralRewarded:false},data:{referralRewarded:true,credits:{increment:100}}});
 if(first.count){await tx.user.update({where:{id:referrer.id},data:{walletBalance:{increment:commission}}});await tx.walletTransaction.create({data:{userId:referrer.id,type:"commission",amount:commission,relatedPaymentId:p.id,relatedUserId:u.id,note:`${percent}% bank purchase commission`}});}
 }
 }
 });
}
