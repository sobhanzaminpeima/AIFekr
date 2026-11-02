import {describe,it,expect,vi} from 'vitest';
import type {Prisma} from '@prisma/client';
import {policyForBundle} from './bundlePolicy';
import {policySchema,configurationSchema,quote} from './domain';
import {creatorBundle} from './creatorBundle';
describe('purchased creator bundle budget',()=>{
 const policy=policySchema.parse({enabled:true,packageRequired:true,creditsPerChapter:5,creditsPerRenderMinute:5,narratedBundlesOnly:true});
 function db(jobs:unknown[]=[],success=true){const entitlementSnapshot=JSON.stringify({category:'VIDEO_FACTORY',days:30,entitlements:creatorBundle.entitlements});return {payment:{findMany:vi.fn(async()=>success?[{id:'payment',createdAt:new Date(),reviewAt:new Date(),entitlementSnapshot}]:[]),findUnique:vi.fn(async()=>({entitlementSnapshot}))},videoFactoryJob:{findMany:vi.fn(async()=>jobs)}} as unknown as Prisma.TransactionClient;}
 it('applies the purchased snapshot and caps a narrated film at 100 credits',async()=>{
  const result=await policyForBundle(db(),'test',60,policy);
  const c=configurationSchema.parse({durationSeconds:60,language:'fa',ratio:'9:16',mode:'AUTOPILOT',quality:'SMART',budgetCap:500,mediaMode:'MULTIMEDIA',narration:true});
  expect(quote(c,result).credits).toBe(100);expect(result.commercial.mode).toBe('ACTION');
 });
 it('does not grant bundle pricing without a successful purchase or after all five slots are used',async()=>{
  expect(await policyForBundle(db([],false),'test',60,policy)).toBe(policy);
  const jobs=Array.from({length:5},()=>({policy:JSON.stringify({packageUsage:{paymentId:'payment',seconds:60}})}));
  expect(await policyForBundle(db(jobs),'test',60,policy)).toBe(policy);
 });
});
