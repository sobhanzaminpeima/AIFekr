import {NextRequest,NextResponse} from 'next/server';
import {Prisma} from '@prisma/client';
import {z} from 'zod';
import {prisma} from '@/lib/db/prisma';
import {requireAuth,unauthorizedResponse} from '@/lib/auth/middleware';
import {rateLimit} from '@/lib/utils/rateLimit';
import {storeConfiguration,storeAccountId,purchaseTokenHash,verifyPlayPurchase,StoreError} from '@/lib/mobile/googlePlay';
export const dynamic='force-dynamic';
const reply=(value:unknown,status=200)=>NextResponse.json(value,{status,headers:{'Cache-Control':'no-store'}});
const input=z.object({productId:z.string().min(1).max(100),purchaseToken:z.string().min(10).max(4096)}).strict();
async function access(req:NextRequest){const user=await requireAuth(req);if(!user)return {error:unauthorizedResponse(req)};if(!rateLimit(`mobile-billing:${user.id}`,20,60000).allowed)return {error:reply({error:'Rate limit'},429)};return {user};}
export async function GET(req:NextRequest){const auth=await access(req);if(auth.error)return auth.error;
 try{const config=storeConfiguration();return reply({enabled:true,mode:'sandbox',platform:'android',products:config.catalog,accountId:storeAccountId(auth.user!.id,config.secret),wallet:'personal',subscriptionExtended:false});}
 catch{return reply({enabled:false,mode:'disabled',products:[]});}}
export async function POST(req:NextRequest){const auth=await access(req);if(auth.error)return auth.error;const userId=auth.user!.id;
 try{const config=storeConfiguration();const parsed=input.safeParse(await req.json().catch(()=>null));if(!parsed.success)return reply({error:'Invalid purchase request'},400);const body=parsed.data,product=config.catalog.find(p=>p.id===body.productId);if(!product)return reply({error:'Unknown store product'},400);const tokenHash=purchaseTokenHash(body.purchaseToken);
  const existing=await prisma.mobileStorePurchase.findUnique({where:{tokenHash}});
  if(existing)return existing.userId===userId&&existing.productId===product.id&&existing.state==='GRANTED'?reply({verified:true,credits:existing.credits,replayed:true,finishAllowed:true}):reply({error:'Purchase cannot be applied to this account'},409);
  const verified=await verifyPlayPurchase(body.purchaseToken,product.id,userId);
  const saved=await prisma.$transaction(async tx=>{const purchase=await tx.mobileStorePurchase.create({data:{tokenHash,orderId:verified.orderId,userId,productId:product.id,credits:product.credits,testPurchase:verified.testPurchase}});await tx.user.update({where:{id:userId},data:{credits:{increment:product.credits}}});await tx.auditLog.create({data:{actorId:userId,action:'mobile.store.sandbox.grant',targetId:purchase.id,metadata:JSON.stringify({productId:product.id,credits:product.credits,wallet:'personal'})}});return purchase;});
  return reply({verified:true,credits:saved.credits,replayed:false,finishAllowed:true});
 }catch(error){if(error instanceof StoreError)return reply({error:error.message},error.status);if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2002')return reply({error:'Purchase already recorded; retry verification'},409);return reply({error:'Purchase verification unconfirmed; retry the same purchase token'},503);}}
