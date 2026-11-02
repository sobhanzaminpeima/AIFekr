import {describe,it,expect} from 'vitest';
import {creatorBundle} from './creatorBundle';
import {configurationSchema,policySchema,quote} from './domain';
describe('owner-approved creator bundle',()=>{
 it('records the exact sale price, list price, credits and video limits',()=>{
  expect(creatorBundle.termPrices.monthly).toBe(4250000);
  expect(creatorBundle.entitlements.limits).toMatchObject({videoCount:5,videoSeconds:300,videoMaxSeconds:60,compareAtToman:7000000});
  expect(creatorBundle.credits).toBe(500);
 });
 it('can budget five narrated films inside the purchased credit allocation',()=>{
  const policy=policySchema.parse({enabled:true,bundleCredits:100,creditsPerChapter:5,creditsPerRenderMinute:5,creditsPerImage:5,creditsPerVoice:5,creditsPerResearch:5,commercial:{mode:'ACTION'},presets:{SMART:{imagePercent:100,videoPercent:0}}});
  const config=configurationSchema.parse({durationSeconds:60,language:'fa',ratio:'9:16',mode:'AUTOPILOT',quality:'SMART',mediaMode:'MULTIMEDIA',narration:true,music:false,shotsPerChapter:8,budgetCap:500});
  expect(quote(config,policy).credits*5).toBeLessThanOrEqual(500);
 });
});
