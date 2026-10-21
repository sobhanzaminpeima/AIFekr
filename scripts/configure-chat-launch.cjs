/* Explicit release operation; never called by a public GET. No inference or payment requests. */
require('@next/env').loadEnvConfig(process.cwd());
const {PrismaClient}=require('@prisma/client'),defaults=require('../src/lib/billing/chat-starter.json');
const db=new PrismaClient();
(async()=>{
 const model=await db.customAiProvider.findUnique({where:{id:'cloudflare-llama-70b'}});
 if(!model?.enabled||model.model!=='@cf/meta/llama-3.3-70b-instruct-fp8-fast'||model.apiKey!=='cf-ref:platform')throw Error('Approved text provider unavailable');
 await db.$transaction(async tx=>{
  await tx.package.upsert({where:{planCode:defaults.planCode},create:defaults,update:{}});
  const old=await tx.siteSetting.findUnique({where:{key:'independentAiChat'}}),policy=old?JSON.parse(old.value):{};
  await tx.siteSetting.upsert({where:{key:'independentAiChat'},create:{key:'independentAiChat',value:JSON.stringify({...policy,enabled:true,guestTurns:3})},update:{value:JSON.stringify({...policy,enabled:true,guestTurns:3})}});
  const game=await tx.playGame.findUnique({where:{slug:'tower'}});
  if(game?.status==='ENABLED')await tx.playTournament.upsert({where:{id:'play-launch-choice-20261021'},update:{},create:{id:'play-launch-choice-20261021',title:'AIFekr free launch competition',description:'One winner chooses a one-month Student, Fitness or Business package.',gameSlug:game.slug,status:'PUBLISHED',configuration:game.configuration,configVersion:game.version,seed:require('node:crypto').randomBytes(4).readUInt32LE()&0x7fffffff,startsAt:new Date(),endsAt:new Date(Date.now()+7*86400000),maxAttempts:3,maxParticipants:10000,rewardTitle:'MONTHLY_PACKAGE_CHOICE',terms:'Free entry, no purchase required. Three attempts per person. Highest server-verified score wins. Ties use earliest completed result, then session ID. One first-place prize: one month of Student, Fitness or Business, chosen by the winner. Final scores are reviewed for abuse by admin before approval and delivery. Buying any package gives no extra attempts or advantage. No cash prize.'}});
 });
 console.log('Chat Starter catalog ready; three guest turns enabled. No paid API request made.');
})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>db.$disconnect());
