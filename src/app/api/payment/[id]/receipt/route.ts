import { bankError } from "@/lib/payment/bankErrors";
import { NextRequest,NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { createHash } from "crypto";
import { notifyReceipt } from "@/lib/payment/bank";
import { rateLimit } from "@/lib/utils/rateLimit";
export const dynamic="force-dynamic";
const MAX=5*1024*1024;
function mime(b:Buffer){if(b.subarray(0,5).toString()==="%PDF-")return "application/pdf";if(b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return "image/png";if(b[0]===255&&b[1]===216&&b[2]===255)return "image/jpeg";return null;}
export async function GET(req:NextRequest,{params}:{params:{id:string}}){
 const user=await requireAuth(req);if(!user)return new NextResponse(null,{status:401});
 const p=await prisma.payment.findFirst({where:{id:params.id,...(!["ADMIN","SUPER_ADMIN"].includes(user.role)?{userId:user.id}:{})}});
 if(!p?.receiptData)return new NextResponse(null,{status:404});
 return new NextResponse(new Uint8Array(p.receiptData),{headers:{"Content-Type":p.receiptMime||"application/octet-stream","Content-Disposition":`attachment; filename="receipt-${p.id}.${p.receiptMime==="application/pdf"?"pdf":p.receiptMime==="image/png"?"png":"jpg"}"`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Security-Policy":"sandbox"}});
}
export async function POST(req:NextRequest,{params}:{params:{id:string}}){
 const user=await requireAuth(req);if(!user)return bankError(req,"Unauthorized",401);
 if(!rateLimit(`receipt:${user.id}`,8,300000).allowed)return bankError(req,"Too many uploads",429);
 if(Number(req.headers.get("content-length"))>MAX+65536)return bankError(req,"Maximum file size: 5 MB",413);
 let form;try{
 // Bound the body even when the sender omits Content-Length.
 const reader=req.body?.getReader(); if(!reader)throw new Error("Empty upload");
 const chunks:Uint8Array[]=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX+65536){await reader.cancel();return bankError(req,"Maximum file size: 5 MB",413);}chunks.push(value);}
 form=await new Response(Buffer.concat(chunks),{headers:{"Content-Type":req.headers.get("content-type")||""}}).formData();
 }catch{return bankError(req,"Invalid upload",400);}
 const file=form.get("receipt");if(!file||typeof file === "string"||file.size===0||file.size>MAX)return bankError(req,"Upload a JPG, PNG or PDF up to 5 MB",400);
 const data=Buffer.from(await file.arrayBuffer()),type=mime(data);if(!type)return bankError(req,"Invalid file format",400);
 try{
 const result=await prisma.$transaction(async tx => { const updated=await tx.payment.updateMany({where:{id:params.id,userId:user.id,gateway:"bank_transfer",status:"PENDING",receiptAt:null},data:{receiptData:data,receiptMime:type,receiptHash:createHash("sha256").update(data).digest("hex"),receiptAt:new Date()}});
 if(updated.count){const admins=await tx.user.findMany({where:{role:{in:["ADMIN","SUPER_ADMIN"]},isBlocked:false},select:{id:true}});for(const admin of admins)await tx.notification.create({data:{userId:admin.id,type:"payment_receipt",title:"New payment receipt / رسید پرداخت جدید",body:params.id,link:"/admin/financial?status=PENDING"}});}
 return updated; });
 if(!result.count)return bankError(req,"Receipt already submitted or payment unavailable",409);
 }catch(e){if((e as {code?:string}).code==="P2002")return bankError(req,"This receipt was already submitted",409);throw e;}
 await notifyReceipt(params.id);
 return NextResponse.json({success:true});
}
