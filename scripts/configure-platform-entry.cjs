require('@next/env').loadEnvConfig(process.cwd());
const {PrismaClient}=require('@prisma/client'),tiers=require('../src/lib/billing/chat-tiers.json'),base=require('../src/lib/billing/chat-starter.json'),db=new PrismaClient();
(async()=>{
 await db.$transaction(async tx=>{
  for(const tier of tiers)await tx.package.upsert({where:{planCode:tier.planCode},update:{},create:{...base,...tier,termPrices:JSON.stringify({monthly:tier.price/10}),entitlements:JSON.stringify({modules:[],agents:[],limits:{chatCredits:tier.credits}}),isFeatured:tier.planCode==='CHAT_PLUS_30',features:'۳۰ روز دسترسی چت\n'+tier.credits+' کردیت چت\nتاریخچه و ذخیره گفتگو\nبدون تمدید خودکار',featuresEn:'30 days of chat access\n'+tier.credits+' chat credits\nConversation history\nNo automatic renewal'}});
  const current=await tx.siteSetting.findUnique({where:{key:'independentAiChat'}}),policy=current?JSON.parse(current.value):{};
  await tx.siteSetting.upsert({where:{key:'independentAiChat'},create:{key:'independentAiChat',value:JSON.stringify({...policy,enabled:true,guestTurns:0})},update:{value:JSON.stringify({...policy,enabled:true,guestTurns:0})}});
 });
 console.log('Public platform preview enabled; sign-in before generation; chat tiers initialized without overwriting admin edits.');
})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>db.$disconnect());
