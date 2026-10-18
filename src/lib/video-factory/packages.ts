import {z} from "zod";
import type {Prisma} from "@prisma/client";
import {FactoryError} from "./errors";
export const VIDEO_PACKAGE_CATEGORY="VIDEO_FACTORY";
export const videoLimitsSchema=z.object({videoCount:z.number().int().min(1).max(1000),videoSeconds:z.number().int().min(60).max(480000),videoMaxSeconds:z.number().int().min(60).max(480)});
export type PackageUsage={paymentId:string;seconds:number};
/** Called under the account quota write lock; quotas use immutable paid snapshots. */
export async function claimPackage(tx:Prisma.TransactionClient,userId:string,seconds:number,now=new Date()):Promise<PackageUsage>{
 if(!Number.isInteger(seconds)||seconds<15||seconds>480)throw new FactoryError("VIDEO_MAXIMUM_8_MINUTES",400);
 const payments=await tx.payment.findMany({where:{userId,status:"SUCCESS"},orderBy:{createdAt:"asc"},select:{id:true,entitlementSnapshot:true,reviewAt:true,createdAt:true}});
 const jobs=await tx.videoFactoryJob.findMany({where:{userId,status:{notIn:["FAILED","CANCELLED"]}},select:{policy:true}});
 for(const payment of payments){
  let snapshot;try{snapshot=JSON.parse(payment.entitlementSnapshot);}catch{continue;}
  if(snapshot.category!==VIDEO_PACKAGE_CATEGORY)continue;
  const limits=videoLimitsSchema.safeParse(snapshot.entitlements?.limits);
  if(!limits.success||!Number.isInteger(snapshot.days)||new Date(payment.reviewAt||payment.createdAt).getTime()+snapshot.days*86400000<=now.getTime())continue;
  const used=jobs.map(j=>JSON.parse(j.policy).packageUsage as PackageUsage|undefined).filter((u):u is PackageUsage=>u?.paymentId===payment.id);
  if(seconds<=limits.data.videoMaxSeconds&&used.length<limits.data.videoCount&&used.reduce((n,u)=>n+u.seconds,0)+seconds<=limits.data.videoSeconds)return {paymentId:payment.id,seconds};
 }
 throw new FactoryError("VIDEO_PACKAGE_REQUIRED_OR_EXHAUSTED",402);
}
export function settlementCredits(status:string,reserved:number,spent:number){
 const charged=status==="FAILED"?0:Math.min(reserved,Math.max(0,spent));
 return {charged,refund:reserved-charged};
}
