import { bankError } from "@/lib/payment/bankErrors";
import { NextRequest,NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/middleware";
import { reviewBankPayment } from "@/lib/payment/reviewBankPayment";
import {manageUnpaidOrder,PaymentLifecycleError} from "@/lib/payment/adminLifecycle";
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
