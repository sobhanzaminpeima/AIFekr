import { prisma } from "@/lib/db/prisma";
import { publicAppUrl } from "@/lib/utils/publicAppUrl";
import { Resend } from "resend";

export const escapeEmail = (value: string) => value.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));

export async function deliverNotificationEmails(scope: "seo" | "economy") {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM) return;
  const stale = new Date(Date.now() - 300000);
  const available = { emailPending:true, emailSentAt:null, OR:[{emailClaimedAt:null},{emailClaimedAt:{lt:stale}}] };
  const rows = await prisma.notification.findMany({
    where:{...available,type:{startsWith:scope + "_"},...(scope === "seo" ? {emailAttempts:{lt:12}} : {})},
    orderBy:[{emailClaimedAt:"asc"},{createdAt:"asc"}], take:10,
  });
  const sender = new Resend(process.env.RESEND_API_KEY);
  for (const row of rows) {
    const claimedAt = new Date();
    const claim = await prisma.notification.updateMany({where:{id:row.id,...available},data:{emailClaimedAt:claimedAt,emailAttempts:{increment:1}}});
    if (!claim.count) continue;
    const ownedClaim = { id:row.id, emailClaimedAt:claimedAt, emailSentAt:null };
    try {
      const user = await prisma.user.findUnique({where:{id:row.userId},select:{email:true,isBlocked:true,language:true}});
      if (!user?.email || user.isBlocked) throw Error();
      const origin = publicAppUrl();
      const url = new URL(row.link || (scope === "seo" ? "/seo/intelligence" : "/settings"),origin);
      if (url.origin !== origin) throw Error();
      const result = await sender.emails.send({
        from:process.env.RESEND_FROM,to:user.email,subject:`AIFekr · ${row.title}`,
        html:`<div dir="${user.language === "fa" ? "rtl" : "ltr"}"><h2>${escapeEmail(row.title)}</h2><p>${escapeEmail(row.body || "")}</p><a href="${escapeEmail(url.href)}">${scope === "seo" ? "AIFekr SEO" : "مشاهده سفارش در AIFekr"}</a></div>`,
      },{idempotencyKey:`${scope}-notification-${row.id}`});
      if (result.error || !result.data?.id) throw Error();
      await prisma.notification.updateMany({where:ownedClaim,data:{emailSentAt:new Date(),emailPending:false,emailError:null}});
    } catch {
      await prisma.notification.updateMany({where:ownedClaim,data:{emailError:"Email delivery pending; check provider and recipient"}});
    }
  }
}
