import {prisma} from "@/lib/db/prisma";
import {STUDENT_PLAN_CODE} from "@/lib/plans/studentOffer";
/** An explicit admin grant sets the same finite entitlement fields as a paid purchase. */
export async function activateStudentAsAdmin(userId:string,actorId:string,days=90){
 if(!Number.isInteger(days)||days<1||days>365)throw new Error("INVALID_STUDENT_DAYS");
 return prisma.$transaction(async tx=>{
  const current=await tx.user.findUniqueOrThrow({where:{id:userId}});
  const education=await tx.industryPack.upsert({
   where:{slug:"university"},
   update:{},
   create:{slug:"university",name:"دانشگاه / مدرسه",nameEn:"University / School",emoji:"🎓",tagline:"ایجنت دانشجویی و آموزش",valueProposition:"دستیار یادگیری، درس‌ها، برنامه مطالعه و پژوهش",targetCustomers:"[]",painPoints:"[]",agents:"[]",outcomes:"[]",kpis:"[]",color:"#6366f1",gradientFrom:"#312e81",gradientTo:"#6366f1"},
   select:{id:true},
  });
  const pkg=await tx.package.upsert({
   where:{planCode:STUDENT_PLAN_CODE},
   update:{},
   create:{planCode:STUDENT_PLAN_CODE,name:"دانشجویی — سه ماه (۲۲٪ تخفیف)",nameEn:"Student — three months (22% off)",description:"دسترسی سه‌ماهه به فضای دانشجویی AIFekr",category:"STUDENT",baseCurrency:"TRY",termPrices:'{"monthly":279999}',entitlements:'{"modules":["student.workspace"]}',price:0,priceUsd:8000,priceTry:279999,market:"BOTH",duration:90,credits:1000,features:"درس‌ها، جزوه‌ها و یادداشت‌ها\nبرنامهٔ مطالعه و تکلیف‌ها\nزمان‌سنج و گزارش مطالعه\nگروه‌های مطالعه\nابزارهای AI با مصرف کردیت",featuresEn:"Courses, materials and notes\nStudy planning and assignments\nStudy timer and reports\nStudy groups\nAI tools consume credits",isActive:true,publicVisible:true,publicationStatus:"PUBLISHED",sortOrder:16,color:"#ea580c"},
  });
  if(!pkg.isActive)throw new Error("STUDENT_PACKAGE_INACTIVE");
  const alreadyActive=current.plan.startsWith("STUDENT_")&&!!current.planExpiry&&current.planExpiry.getTime()>Date.now();
  const expiry=alreadyActive?current.planExpiry!:new Date(Date.now()+days*86400000);
  const user=await tx.user.update({where:{id:userId},data:{accountType:"STUDENT",plan:alreadyActive?current.plan:STUDENT_PLAN_CODE,planExpiry:expiry,industryPackId:education.id,trialLimited:false,...(!alreadyActive?{credits:{increment:pkg.credits}}:{})}});
  await tx.userModuleOverride.upsert({where:{userId_moduleKey:{userId,moduleKey:"student.workspace"}},create:{userId,moduleKey:"student.workspace",enabled:true},update:{enabled:true}});
  await tx.auditLog.create({data:{actorId,action:"student_activated",targetId:userId,metadata:JSON.stringify({days,planExpiry:expiry,creditsGranted:alreadyActive?0:pkg.credits,previousPlan:current.plan})}});
  return {id:user.id,accountType:user.accountType,plan:user.plan,planExpiry:user.planExpiry};
 });
}
