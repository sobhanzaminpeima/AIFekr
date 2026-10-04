import {prisma} from "@/lib/db/prisma";
import {STUDENT_PLAN_CODE} from "@/lib/plans/studentOffer";
/** An explicit admin grant sets the same finite entitlement fields as a paid purchase. */
export async function activateStudentAsAdmin(userId:string,actorId:string,days=90){
 if(!Number.isInteger(days)||days<1||days>365)throw new Error("INVALID_STUDENT_DAYS");
 return prisma.$transaction(async tx=>{
  const current=await tx.user.findUniqueOrThrow({where:{id:userId}});
  const education=await tx.industryPack.findUnique({where:{slug:"university"},select:{id:true}});
  if(!education)throw new Error("STUDENT_INDUSTRY_NOT_CONFIGURED");
  const pkg=await tx.package.findUnique({where:{planCode:STUDENT_PLAN_CODE}});
  if(!pkg?.isActive)throw new Error("STUDENT_PACKAGE_NOT_CONFIGURED");
  const alreadyActive=current.plan.startsWith("STUDENT_")&&!!current.planExpiry&&current.planExpiry.getTime()>Date.now();
  const expiry=alreadyActive?current.planExpiry!:new Date(Date.now()+days*86400000);
  const user=await tx.user.update({where:{id:userId},data:{accountType:"STUDENT",plan:alreadyActive?current.plan:STUDENT_PLAN_CODE,planExpiry:expiry,industryPackId:education.id,trialLimited:false,...(!alreadyActive?{credits:{increment:pkg.credits}}:{})}});
  await tx.userModuleOverride.upsert({where:{userId_moduleKey:{userId,moduleKey:"student.workspace"}},create:{userId,moduleKey:"student.workspace",enabled:true},update:{enabled:true}});
  await tx.auditLog.create({data:{actorId,action:"student_activated",targetId:userId,metadata:JSON.stringify({days,planExpiry:expiry,creditsGranted:alreadyActive?0:pkg.credits,previousPlan:current.plan})}});
  return {id:user.id,accountType:user.accountType,plan:user.plan,planExpiry:user.planExpiry};
 });
}
