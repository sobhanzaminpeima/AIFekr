import { NextRequest,NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/auth/cronAuth";
import { prisma } from "@/lib/db/prisma";
import { notifyReceipt } from "@/lib/payment/bank";
export const dynamic="force-dynamic";
export async function GET(req:NextRequest){
 if(!isCronAuthorized(req))return NextResponse.json({error:"Unauthorized"},{status:401});
 const rows=await prisma.payment.findMany({where:{gateway:"bank_transfer",receiptAt:{not:null},OR:[{notificationSentAt:null},...(process.env.TELEGRAM_NOTIFICATIONS_ENABLED === "true" ? [{telegramSentAt:null}] : [])]},select:{id:true},take:20,orderBy:{createdAt:"asc"}});
 for(const row of rows)await notifyReceipt(row.id);
 let adminNotifications=0;
 if(process.env.TELEGRAM_NOTIFICATIONS_ENABLED === "true" && process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_ADMIN_CHAT_ID && process.env.TELEGRAM_NOTIFICATIONS_SINCE){
 const since=new Date(process.env.TELEGRAM_NOTIFICATIONS_SINCE);
 if(!Number.isNaN(since.getTime())){
 const notifications=await prisma.notification.findMany({where:{telegramSentAt:null,type:{not:"payment_receipt"},createdAt:{gte:since},user:{role:{in:["ADMIN","SUPER_ADMIN"]},isBlocked:false}},take:20,orderBy:{createdAt:"asc"}});
 for(const item of notifications){let error:string|null=null;try{
 const response=await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chat_id:process.env.TELEGRAM_ADMIN_CHAT_ID,text:`AIFekr: ${item.title}\n${item.body||""}\n${item.link?.startsWith("/")?(process.env.NEXT_PUBLIC_APP_URL||"https://aifekr.com")+item.link:""}`.slice(0,4000)}),signal:AbortSignal.timeout(5000)});
 if(!(await response.json()).ok)throw new Error("Telegram delivery failed");
 }catch(e){error=e instanceof Error?e.message:"Telegram delivery failed";}
 await prisma.notification.update({where:{id:item.id},data:{telegramError:error,...(!error?{telegramSentAt:new Date()}: {})}});adminNotifications++;
 }
 }
 }
 return NextResponse.json({processed:rows.length,adminNotifications});
}
