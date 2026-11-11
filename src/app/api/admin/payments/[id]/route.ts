import { prisma } from "@/lib/db/prisma";
import { bankError } from "@/lib/payment/bankErrors";
import { NextRequest,NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/middleware";
import { reviewBankPayment } from "@/lib/payment/reviewBankPayment";
import {manageUnpaidOrder,PaymentLifecycleError} from "@/lib/payment/adminLifecycle";
/** One order for the admin invoice page: the payment, its buyer's contact and the subscription days it grants. */
export async function GET(req:NextRequest, props:{params: Promise<{id:string}>}) {
 const {id}=await props.params;
 const admin=await requireAdmin(req);if(!admin)return NextResponse.json({error:"Forbidden"},{status:403});
 const p=await prisma.payment.findUnique({where:{id},select:{id:true,userId:true,plan:true,status:true,gateway:true,amount:true,transferMinor:true,transferCurrency:true,refId:true,receiptAt:true,promoPercent:true,promoCode:true,entitlementSnapshot:true,createdAt:true,user:{select:{name:true,email:true,phone:true}}}});
 if(!p)return NextResponse.json({error:"NOT_FOUND"},{status:404});
 let days:number|null=null;try{days=JSON.parse(p.entitlementSnapshot||"{}").days||null;}catch{}
 const {entitlementSnapshot:_snapshot,...payment}=p;void _snapshot;
 return NextResponse.json({payment:{...payment,days,hasReceipt:!!p.receiptAt}});
}
export async function PATCH(req:NextRequest, props:{params: Promise<{id:string}>}) {
 const params = await props.params;
 const admin=await requireAdmin(req);if(!admin)return bankError(req,"Forbidden",403);
 if(req.headers.get("origin")!==(process.env.NODE_ENV==="production"?"https://aifekr.com":req.nextUrl.origin))return bankError(req,"Forbidden",403);
 let body;try{body=await req.json();}catch{return bankError(req,"Invalid request",400);}
 if(["cancel","continue"].includes(body.action)){
  if(typeof body.note!=="string"||body.note.trim().length<3||body.note.length>1000)return bankError(req,"Invalid request",400);
  try{return NextResponse.json(await manageUnpaidOrder(params.id,admin.id,body.action,body.note.trim()));}catch(e){if(e instanceof PaymentLifecycleError)return bankError(req,e.code,e.status);throw e;}
 }
 if(!["approve","reject"].includes(body.action)||typeof body.note!=="string"||body.note.length>1000||body.action==="reject"&&!body.note.trim())return bankError(req,"Invalid action or review note",400);
 try{await reviewBankPayment(params.id,admin.id,body.action==="approve",body.note.trim());return NextResponse.json({success:true});}catch(e){if(e instanceof Error&&["NOT_REVIEWABLE","ALREADY_REVIEWED","TEAM_CAPACITY_EXCEEDED"].includes(e.message))return bankError(req,e.message,409);throw e;}
}
