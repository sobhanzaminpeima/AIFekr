import type {Prisma} from "@prisma/client";
/** Standalone purchases remain separate from a bundle downgrade or renewal. */
export async function standaloneVoiceExpiry(tx:Prisma.TransactionClient,userId:string):Promise<Date|null>{
 const rows=await tx.payment.findMany({where:{userId,status:"SUCCESS",plan:{startsWith:"VOICE_"}},select:{reviewAt:true,createdAt:true,entitlementSnapshot:true,periodMonths:true}});
 rows.sort((a,b)=>(a.reviewAt||a.createdAt).getTime()-(b.reviewAt||b.createdAt).getTime());
 let expiry=0;
 for(const r of rows){let days=30*Math.max(1,r.periodMonths);try{const stored=JSON.parse(r.entitlementSnapshot||"{}").days;if(Number.isFinite(stored)&&stored>0)days=stored}catch{}expiry=Math.max(expiry,(r.reviewAt||r.createdAt).getTime())+days*86400000;}
 return expiry>Date.now()?new Date(expiry):null;
}
