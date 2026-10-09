import { prisma } from "@/lib/db/prisma";
import { Resend } from "resend";
import { publicAppUrl } from "@/lib/utils/publicAppUrl";
const escape = (v:string) => v.replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
/** Each new User is a durable outbox entry, including Google, OTP and admin creation. */
export async function deliverSignupNotifications() {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM) return {sent:0,pending:true,configured:false};
  const retryBefore = new Date(Date.now() - 5 * 60000);
  const users = await prisma.user.findMany({where:{signupNotifiedAt:null,OR:[{signupNotificationClaimedAt:null},{signupNotificationClaimedAt:{lt:retryBefore}}]},orderBy:{createdAt:"asc"},take:20});
  let sent=0;
  for (const user of users) {
    const claim = await prisma.user.updateMany({where:{id:user.id,signupNotifiedAt:null,OR:[{signupNotificationClaimedAt:null},{signupNotificationClaimedAt:{lt:retryBefore}}]},data:{signupNotificationClaimedAt:new Date(),signupNotificationAttempts:{increment:1}}});
    if (!claim.count) continue;
    try {
      const rows = [["Name",user.name||"Not provided"],["Email",user.email||"Not provided"],["Phone",user.phone||"Not provided"],["Account type",user.accountType],["Sign-up method",user.authProvider|| (user.passwordHash?"password":"phone")],["Created (UTC)",user.createdAt.toISOString()]];
      const result = await new Resend(process.env.RESEND_API_KEY).emails.send({from:process.env.RESEND_FROM,to:process.env.SIGNUP_NOTIFICATION_TO||"support@aifekr.com",subject:"AIFekr: new user registration",html:`<div style="font-family:Arial;padding:24px"><h2>New AIFekr account</h2><table>${rows.map(([label,value])=>`<tr><th style="text-align:left;padding:8px">${label}</th><td style="padding:8px">${escape(value)}</td></tr>`).join("")}</table><p><a href="${publicAppUrl()}/admin/users/${encodeURIComponent(user.id)}">View user in administration</a></p></div>`},{idempotencyKey:`aifekr-signup-${user.id}`});
      if (result.error||!result.data?.id) throw Error("Email rejected");
      await prisma.user.update({where:{id:user.id},data:{signupNotifiedAt:new Date(),signupNotificationError:null}});sent++;
    } catch {
      await prisma.user.update({where:{id:user.id},data:{signupNotificationError:"Delivery pending; check Resend configuration and recipient"}});
    }
  }
  return {sent,pending:users.length>sent,configured:true};
}
