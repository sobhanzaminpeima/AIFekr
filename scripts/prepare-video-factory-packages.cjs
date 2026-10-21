/* Explicit draft preparation. No provider request, purchase, or sales activation. */
require('@next/env').loadEnvConfig(process.cwd());
const {PrismaClient}=require('@prisma/client');const db=new PrismaClient();
async function main(){
 const actor=await db.user.findFirst({where:{role:{in:['SUPER_ADMIN','ADMIN']}},select:{id:true}});if(!actor)throw Error('ADMIN_REQUIRED');
 const tiers=[['VF_STARTER','شروع کانال','Channel Starter',2999,3000,3,18,360],['VF_CREATOR','تولیدکننده','Creator',6999,7500,8,48,480],['VF_STUDIO','استودیو','Studio',11999,14000,15,90,480]];
 await db.$transaction(async tx=>{
  for(const [planCode,name,nameEn,priceUsd,credits,videoCount,minutes,videoMaxSeconds] of tiers){
   const data={name,nameEn,price:0,priceUsd,credits,duration:30,category:'VIDEO_FACTORY',publicationStatus:'DRAFT',publicVisible:false,isActive:true,baseCurrency:'USD',termPrices:JSON.stringify({monthly:priceUsd}),creditAllocation:'TERM',market:'BOTH',features:`${videoCount} ویدیو | ${minutes} دقیقه تولید | حداکثر ${videoMaxSeconds/60} دقیقه برای هر ویدیو | بازگشت اعتبار شکست فنی`,featuresEn:`${videoCount} videos\n${minutes} production minutes\nUp to ${videoMaxSeconds/60} minutes per video\nTechnical failure credit protection`,entitlements:JSON.stringify({modules:['video-factory'],agents:[],limits:{videoCount,videoSeconds:minutes*60,videoMaxSeconds}})};
   // Never replace a published or purchased offer with new terms implicitly.
   const existing=await tx.package.findUnique({where:{planCode}});if(existing)continue;
   await tx.package.create({data:{planCode,...data}});
  }
  const row=await tx.siteSetting.findUnique({where:{key:'videoFactoryPolicy'}});const policy=JSON.parse(row?.value||'{}');
  policy.packageRequired=true;delete policy.packageUsage;
  policy.enabled=false;policy.commercial={...policy.commercial,status:'DRAFT',estimated:true,mode:'DURATION_RETAIL',referencePlanCode:'VF_STARTER',baseSeconds:60,saleCents:144,estimatedCostCents:80,overheadCents:20,creditRate:null};
  await tx.siteSetting.upsert({where:{key:'videoFactoryPolicy'},create:{key:'videoFactoryPolicy',value:JSON.stringify(policy)},update:{value:JSON.stringify(policy)}});
  await tx.videoFactoryResource.upsert({where:{id:'package-cost-assumptions'},create:{id:'package-cost-assumptions',kind:'PRICING_WORKSHEET',name:'Draft package economics — verify supplier prices before launch',enabled:false,configuration:JSON.stringify({status:'DRAFT',verified:false,unit:'USD cents per output minute',productionBudget:80,platformOverhead:20,safetyBufferIncluded:true,requiredRates:['Opus 5.5 input/output tokens','GPT scenario tokens','Nano Banana per image','Argon exact provider/model and clip-second rate','Voice/music','Rendering/storage','Payment fees'],note:'Planning assumptions only; not verified supplier quotes. No revenue or YouTube monetization guarantee.'})},update:{}});
  await tx.auditLog.create({data:{actorId:actor.id,action:'video_factory.packages_prepared',metadata:JSON.stringify({salesEnabled:false,paidRequests:0,codes:tiers.map(t=>t[0])})}});
 });
 console.log(JSON.stringify({draftPackages:tiers.map(t=>({code:t[0],usd:t[3]/100,credits:t[4],videos:t[5],minutes:t[6],maxMinutes:t[7]/60})),paidRequests:0,salesEnabled:false}));
}main().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>db.$disconnect());
