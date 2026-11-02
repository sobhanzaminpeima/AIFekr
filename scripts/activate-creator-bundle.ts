import {prisma} from '../src/lib/db/prisma';
import {creatorBundle} from '../src/lib/video-factory/creatorBundle';
import {settingsSchema} from '../src/lib/voice-studio/domain';
async function main(){
 const actor=await prisma.user.findFirstOrThrow({where:{role:'SUPER_ADMIN'},select:{id:true}});
 await prisma.$transaction(async tx=>{
  const row=await tx.siteSetting.findUniqueOrThrow({where:{key:'voiceStudioSettings'}});
  const voice=settingsSchema.parse(JSON.parse(row.value));voice.trialGenerations=2;voice.trialFree=true;voice.trialMaxSeconds=30;voice.version++;
  await tx.siteSetting.update({where:{key:row.key},data:{value:JSON.stringify(voice)}});
  const {planCode,termPrices,entitlements,id,...rest}=creatorBundle;
  const offer={...rest,termPrices:JSON.stringify(termPrices),entitlements:JSON.stringify(entitlements)};
  await tx.package.upsert({where:{planCode},create:{planCode,...offer},update:offer});
  const credential=await tx.siteSetting.findUniqueOrThrow({where:{key:'voiceStudioSecret'}});
  const catalog=JSON.parse((await tx.siteSetting.findUniqueOrThrow({where:{key:'voiceStudioCatalog'}})).value);
  if(!catalog.models.some((m:{id:string})=>m.id==='eleven_v3')||!catalog.voices[0]?.id)throw Error('VERIFIED_VOICE_REQUIRED');
  const provider=await tx.videoFactoryProvider.findUniqueOrThrow({where:{id:'vf-eleven-voice'}});
  const settings={...JSON.parse(provider.settings),commercialApproved:true,safetyReviewed:true,defaultVoiceId:catalog.voices[0].id,languages:['fa','en','de','tr']};
  await tx.videoFactoryProvider.update({where:{id:provider.id},data:{enabled:true,secret:credential.value,settings:JSON.stringify(settings),version:{increment:1}}});
  const policyRow=await tx.siteSetting.findUniqueOrThrow({where:{key:'videoFactoryPolicy'}});
  const policy=JSON.parse(policyRow.value);policy.silentOnly=false;policy.narratedBundlesOnly=true;policy.providers.tts=provider.id;policy.creditsPerVoice=policy.creditsPerVoice||5;
  await tx.siteSetting.update({where:{key:policyRow.key},data:{value:JSON.stringify(policy)}});
  await tx.auditLog.create({data:{actorId:actor.id,action:'owner_approved.voice_trials_and_creator_bundle',metadata:JSON.stringify({trialGenerations:2,trialSeconds:30,trialFree:true,planCode,priceToman:4250000,listPriceToman:7000000,credits:500,videoCount:5,videoMaxSeconds:60,narration:true})}});
 });console.log('OWNER_APPROVED_OFFER_AND_TRIALS_SAVED');await prisma.$disconnect();
}main().catch(()=>{console.error('CONFIGURATION_UPDATE_FAILED');process.exitCode=1;});
