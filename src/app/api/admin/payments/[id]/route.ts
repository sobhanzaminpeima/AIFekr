import { bankError } from "@/lib/payment/bankErrors";
import { NextRequest,NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/middleware";
import { reviewBankPayment } from "@/lib/payment/reviewBankPayment";
export async function PATCH(req:NextRequest,{params}:{params:{id:string}}){
 const admin=await requireAdmin(req);if(!admin)return bankError(req,"Forbidden",403);
 let body;try{body=await req.json();}catch{return bankError(req,"Invalid request",400);}
 if(!["approve","reject"].includes(body.action)||typeof body.note!=="string"||body.note.length>1000||body.action==="reject"&&!body.note.trim())return bankError(req,"Invalid action or review note",400);
 try{await reviewBankPayment(params.id,admin.id,body.action==="approve",body.note.trim());return NextResponse.json({success:true});}catch(e){if(e instanceof Error&&["NOT_REVIEWABLE","ALREADY_REVIEWED"].includes(e.message))return bankError(req,e.message,409);throw e;}
}
