import type {Policy} from './domain';
import {claimPackage} from './packages';
import type {Prisma} from '@prisma/client';
import {FactoryError} from './errors';
/** Package-specific action rates keep five 60-second narrated films within 500 credits. */
export async function policyForBundle(db:Prisma.TransactionClient,userId:string,seconds:number,policy:Policy):Promise<Policy>{
 if(!policy.packageRequired)return policy;
 let usage;
 try{usage=await claimPackage(db,userId,seconds);}catch(error){if(error instanceof FactoryError && error.message==='VIDEO_PACKAGE_REQUIRED_OR_EXHAUSTED')return policy;throw error;}
 const payment=await db.payment.findUnique({where:{id:usage.paymentId},select:{entitlementSnapshot:true}});
 const snapshot=JSON.parse(payment?.entitlementSnapshot||'{}');
 if(snapshot.entitlements?.limits?.creatorBundle!==1)return policy;
 return {...policy,creditsPerChapter:5,creditsPerRenderMinute:5,creditsPerImage:5,creditsPerVoice:5,creditsPerResearch:5,
  commercial:{...policy.commercial,mode:'ACTION'},bundleCredits:100,
  presets:{...policy.presets,SMART:{imagePercent:100,videoPercent:0},CINEMATIC_HYBRID:{imagePercent:100,videoPercent:0},FILM_STUDIO:{imagePercent:100,videoPercent:0}}};
}
