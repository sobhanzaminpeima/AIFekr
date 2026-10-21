import { prisma } from "@/lib/db/prisma";
import { Resend } from "resend";
import { publicAppUrl } from "@/lib/utils/publicAppUrl";
import { tri } from "@/lib/i18n/tri";
import type { Lang } from "@/lib/i18n";
export const escapeEmail = (value: string) => value.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
export async function notifySeoActivities() {
 const now=new Date();const stale=new Date(Date.now()-300000);
 const jobs=await prisma.seoResearchJob.findMany({where:{status:{in:["SUCCEEDED","FAILED"]},notificationSentAt:null,notificationAttempts:{lt:12},OR:[{notificationClaimedAt:null},{notificationClaimedAt:{lt:stale}}]},orderBy:{completedAt:"asc"},take:10});
 for(const job of jobs){
  const won=await prisma.seoResearchJob.updateMany({where:{id:job.id,notificationSentAt:null,OR:[{notificationClaimedAt:null},{notificationClaimedAt:{lt:stale}}]},data:{notificationClaimedAt:now,notificationAttempts:{increment:1}}});if(!won.count)continue;
  try{
   const user=await prisma.user.findUnique({where:{id:job.userId},select:{email:true,language:true,isBlocked:true}});const lang:Lang=["fa","en","de","tr"].includes(user?.language||"")?user!.language as Lang:"en";
   const success=job.status==="SUCCEEDED";
   const title=tri(lang,success?"نتیجهٔ فعالیت سئو آماده است":"فعالیت سئو انجام نشد",success?"Your SEO result is ready":"SEO activity failed",success?"Dein SEO-Ergebnis ist bereit":"SEO-Aktivität fehlgeschlagen",success?"SEO sonucunuz hazır":"SEO işlemi başarısız");
   const body=tri(lang,success?"نتیجه را در SEO Intelligence ببینید.":"اعتبار این فعالیت بازگردانده شد. جزئیات را در پنل ببینید.",success?"View your result in SEO Intelligence.":"Credits for this activity were refunded. View details in your workspace.",success?"Ergebnis in SEO Intelligence ansehen.":"Die Credits wurden erstattet. Details im Arbeitsbereich ansehen.",success?"Sonucunuzu SEO Intelligence içinde görün.":"Bu işlem için krediler iade edildi. Ayrıntıları panelinizde görün.");
   if(!job.notificationCreatedAt)await prisma.$transaction(async tx=>{await tx.notification.create({data:{userId:job.userId,type:"seo_activity",title,body,link:"/seo/intelligence"}});await tx.seoResearchJob.update({where:{id:job.id},data:{notificationCreatedAt:new Date()}});});
   if(!user?.email||user.isBlocked)throw Error("Recipient email unavailable");
   if(!process.env.RESEND_API_KEY||!process.env.RESEND_FROM)throw Error("Email provider is not configured");
   const sent=await new Resend(process.env.RESEND_API_KEY).emails.send({from:process.env.RESEND_FROM,to:user.email,subject:`AIFekr · ${title}`,html:`<div dir="${lang==="fa"?"rtl":"ltr"}" style="font-family:Arial;padding:28px"><h2>${escapeEmail(title)}</h2><p>${escapeEmail(body)}</p><p>SEO Intelligence · ${escapeEmail(job.action)}</p><a href="${publicAppUrl()}/seo/intelligence" style="color:#ea580c">${escapeEmail(tri(lang,"مشاهدهٔ فعالیت","View activity","Aktivität ansehen","İşlemi görüntüle"))}</a></div>`},{idempotencyKey:`seo-activity-${job.id}`});
   if(sent.error||!sent.data?.id)throw Error("Email provider rejected notification");
   await prisma.seoResearchJob.update({where:{id:job.id},data:{notificationSentAt:new Date(),notificationError:null}});
  }catch{await prisma.seoResearchJob.update({where:{id:job.id},data:{notificationError:"Email delivery pending; check provider configuration and recipient"}});}
 }
}

export async function deliverSeoNotifications(){
 const stale=new Date(Date.now()-300000);const rows=await prisma.notification.findMany({where:{type:{startsWith:"seo_"},emailPending:true,emailSentAt:null,emailAttempts:{lt:12},OR:[{emailClaimedAt:null},{emailClaimedAt:{lt:stale}}]},take:10,orderBy:{createdAt:"asc"}});
 for(const row of rows){const claim=await prisma.notification.updateMany({where:{id:row.id,emailSentAt:null,OR:[{emailClaimedAt:null},{emailClaimedAt:{lt:stale}}]},data:{emailClaimedAt:new Date(),emailAttempts:{increment:1}}});if(!claim.count)continue;
 try{const user=await prisma.user.findUnique({where:{id:row.userId},select:{email:true,isBlocked:true,language:true}});if(!user?.email||user.isBlocked||!process.env.RESEND_API_KEY||!process.env.RESEND_FROM)throw Error();const url=new URL(row.link||"/seo/intelligence",publicAppUrl());if(url.origin!==publicAppUrl())throw Error();const sent=await new Resend(process.env.RESEND_API_KEY).emails.send({from:process.env.RESEND_FROM,to:user.email,subject:`AIFekr · ${row.title}`,html:`<div dir="${user.language==="fa"?"rtl":"ltr"}" style="font-family:Arial;padding:28px"><h2>${escapeEmail(row.title)}</h2><p>${escapeEmail(row.body||"")}</p><a href="${escapeEmail(url.toString())}">AIFekr SEO</a></div>`},{idempotencyKey:`seo-notification-${row.id}`});if(sent.error||!sent.data?.id)throw Error();await prisma.notification.update({where:{id:row.id},data:{emailSentAt:new Date(),emailPending:false,emailError:null}});}catch{await prisma.notification.update({where:{id:row.id},data:{emailError:"Email delivery pending; check provider and recipient"}});}
 }
}
