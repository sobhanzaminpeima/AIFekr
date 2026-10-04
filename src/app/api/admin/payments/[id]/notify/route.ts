import {NextRequest,NextResponse} from "next/server";
import {requireAdmin,forbiddenResponse} from "@/lib/auth/middleware";
import {prisma} from "@/lib/db/prisma";
import {notifyReceipt} from "@/lib/payment/bank";
import {rateLimit} from "@/lib/utils/rateLimit";
export const dynamic="force-dynamic";
export async function POST(req:NextRequest,{params}:{params:{id:string}}){
 const admin=await requireAdmin(req);if(!admin)return forbiddenResponse();
 if(!rateLimit(`receipt-notify:${admin.id}`,5,300000).allowed)return NextResponse.json({error:"کمی صبر کنید."},{status:429});
 const payment=await prisma.payment.findUnique({where:{id:params.id},select:{userId:true,receiptAt:true,gateway:true}});
 if(!payment?.receiptAt||payment.gateway!=="bank_transfer")return NextResponse.json({error:"رسید پیدا نشد."},{status:404});
 await prisma.payment.update({where:{id:params.id},data:{notificationSentAt:null}});
 await notifyReceipt(params.id);
 const status=await prisma.payment.findUniqueOrThrow({where:{id:params.id},select:{notificationSentAt:true,notificationError:true}});
 await prisma.auditLog.create({data:{actorId:admin.id,action:"receipt_email_retried",targetId:payment.userId,metadata:JSON.stringify({paymentId:params.id,accepted:!!status.notificationSentAt})}});
 return NextResponse.json({accepted:!!status.notificationSentAt,error:status.notificationError},{status:status.notificationSentAt?200:502});
}
