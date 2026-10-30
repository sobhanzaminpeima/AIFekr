export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db/prisma";
import { signToken, signRefreshToken } from "@/lib/auth/jwt";
import { publicAppUrl } from "@/lib/utils/publicAppUrl";
import { readGoogleContext } from "@/lib/auth/googleContext";
import { accountTypeFor } from "@/lib/auth/accountAudience";
import { generateUniqueReferralCode } from "@/lib/utils/referralCode";
import { createUser, findUserByReferralCode } from "@/lib/repositories/userRepository";
import { onAccountCreated } from "@/lib/growth/signup";
import { ANON_COOKIE } from "@/lib/growth/attribution";
import { resolvePromo } from "@/lib/utils/referralPromo";
import { tri } from "@/lib/i18n/tri";
import type { Lang } from "@/lib/i18n";
function clearOAuth(response:NextResponse) {
  for(const key of ["google_oauth_state","google_oauth_context"]) response.cookies.set(key,"",{maxAge:0,path:"/"});
  return response;
}
/** The login page shows the reason as is, so it is sent in the visitor's language. */
const FAILURES: Record<string, [fa: string, de: string, tr: string]> = {
  "Google authorization code is missing.": ["کد ورود گوگل دریافت نشد. دوباره تلاش کنید.", "Der Google-Anmeldecode fehlt. Bitte erneut versuchen.", "Google giriş kodu eksik. Lütfen tekrar deneyin."],
  "Google authorization failed. Please try again or contact support.": ["ورود با گوگل انجام نشد. دوباره تلاش کنید یا با پشتیبانی تماس بگیرید.", "Die Google-Anmeldung ist fehlgeschlagen. Bitte erneut versuchen oder den Support kontaktieren.", "Google ile giriş başarısız oldu. Tekrar deneyin veya destekle iletişime geçin."],
  "Google authorization failed.": ["ورود با گوگل انجام نشد.", "Die Google-Anmeldung ist fehlgeschlagen.", "Google ile giriş başarısız oldu."],
  "Google sign-in failed. Please retry or contact support.": ["ورود با گوگل انجام نشد. دوباره تلاش کنید یا با پشتیبانی تماس بگیرید.", "Die Google-Anmeldung ist fehlgeschlagen. Bitte erneut versuchen oder den Support kontaktieren.", "Google ile giriş başarısız oldu. Tekrar deneyin veya destekle iletişime geçin."],
  "Google sign-in is not configured.": ["ورود با گوگل فعلاً در دسترس نیست.", "Die Google-Anmeldung ist derzeit nicht verfügbar.", "Google ile giriş şu anda kullanılamıyor."],
  "Google sign-in was cancelled. Please try again.": ["ورود با گوگل لغو شد. دوباره تلاش کنید.", "Die Google-Anmeldung wurde abgebrochen. Bitte erneut versuchen.", "Google ile giriş iptal edildi. Lütfen tekrar deneyin."],
  "Invalid Google sign-in request. Please try again.": ["درخواست ورود با گوگل معتبر نبود. دوباره تلاش کنید.", "Ungültige Google-Anmeldeanfrage. Bitte erneut versuchen.", "Geçersiz Google giriş isteği. Lütfen tekrar deneyin."],
  "Invalid invitation code. Please check your registration link.": ["کد دعوت معتبر نیست. لینک ثبت‌نام را بررسی کنید.", "Ungültiger Einladungscode. Bitte prüfen Sie Ihren Registrierungslink.", "Geçersiz davet kodu. Kayıt bağlantınızı kontrol edin."],
  "Invitation link and code belong to different people.": ["لینک دعوت و کد دعوت متعلق به دو نفر متفاوت است.", "Einladungslink und Code gehören verschiedenen Personen.", "Davet bağlantısı ve kodu farklı kişilere ait."],
  "This email is linked to another Google account. Contact support.": ["این ایمیل به حساب گوگل دیگری متصل است. با پشتیبانی تماس بگیرید.", "Diese E-Mail ist mit einem anderen Google-Konto verknüpft. Bitte den Support kontaktieren.", "Bu e-posta başka bir Google hesabına bağlı. Destekle iletişime geçin."],
  "Unable to load your Google profile.": ["اطلاعات حساب گوگل شما دریافت نشد.", "Ihr Google-Profil konnte nicht geladen werden.", "Google profiliniz yüklenemedi."],
  "Use a Google account with a verified email address.": ["از حساب گوگلی استفاده کنید که ایمیل آن تأیید شده باشد.", "Verwenden Sie ein Google-Konto mit bestätigter E-Mail-Adresse.", "Doğrulanmış e-posta adresi olan bir Google hesabı kullanın."],
  "Your account is blocked. Contact support.": ["حساب شما مسدود شده است. با پشتیبانی تماس بگیرید.", "Ihr Konto ist gesperrt. Bitte den Support kontaktieren.", "Hesabınız engellendi. Destekle iletişime geçin."],
};
function fail(lang:Lang,reason:string) { const t=FAILURES[reason]; return clearOAuth(NextResponse.redirect(`${publicAppUrl()}/login?error=${encodeURIComponent(t?tri(lang,t[0],reason,t[1],t[2]):reason)}`)); }
export async function GET(req:NextRequest) {
  const cookieLang=req.cookies.get("lang")?.value,lang:Lang=cookieLang==="en"||cookieLang==="de"||cookieLang==="tr"?cookieLang:"fa";
  const code=req.nextUrl.searchParams.get("code");
  const state=req.nextUrl.searchParams.get("state");
  const saved=req.cookies.get("google_oauth_state")?.value;
  if(!state||!saved||Buffer.byteLength(state)!==Buffer.byteLength(saved)||!timingSafeEqual(Buffer.from(state),Buffer.from(saved)))return fail(lang,"Invalid Google sign-in request. Please try again.");
  if(req.nextUrl.searchParams.get("error"))return fail(lang,"Google sign-in was cancelled. Please try again.");
  if(!code)return fail(lang,"Google authorization code is missing.");
  const clientId=process.env.GOOGLE_CLIENT_ID,clientSecret=process.env.GOOGLE_CLIENT_SECRET;
  if(!clientId||!clientSecret)return fail(lang,"Google sign-in is not configured.");
  const context=readGoogleContext(req.cookies.get("google_oauth_context")?.value);
  try {
    const tokenRes=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({code,client_id:clientId,client_secret:clientSecret,redirect_uri:`${publicAppUrl()}/api/auth/google/callback`,grant_type:"authorization_code"}),cache:"no-store",signal:AbortSignal.timeout(10000)});
    if(!tokenRes.ok)return fail(lang,"Google authorization failed. Please try again or contact support.");
    const tokens=await tokenRes.json();if(typeof tokens.access_token!=="string")return fail(lang,"Google authorization failed.");
    const profileRes=await fetch("https://openidconnect.googleapis.com/v1/userinfo",{headers:{Authorization:`Bearer ${tokens.access_token}`},cache:"no-store",signal:AbortSignal.timeout(10000)});
    if(!profileRes.ok)return fail(lang,"Unable to load your Google profile.");
    const profile=await profileRes.json();
    if(typeof profile.sub!=="string"||!profile.sub||typeof profile.email!=="string"||profile.email_verified!==true)return fail(lang,"Use a Google account with a verified email address.");
    const email=profile.email.trim().toLowerCase();
    let user=await prisma.user.findUnique({where:{googleId:profile.sub}});
    let created=false;
    let contextual:string|null=null;
    if(!user){
      user=await prisma.user.findUnique({where:{email}});
      if(user){
        if(user.isBlocked)return fail(lang,"Your account is blocked. Contact support.");
        if(user.googleId&&user.googleId!==profile.sub)return fail(lang,"This email is linked to another Google account. Contact support.");
        user=await prisma.user.update({where:{id:user.id},data:{googleId:profile.sub,authProvider:"google",avatar:user.avatar||profile.picture}});
      } else {
        const referrer=context.ref?await findUserByReferralCode(context.ref):null;
        const promo=context.promoCode?await resolvePromo(context.promoCode):null;
        if(context.promoCode&&!promo)return fail(lang,"Invalid invitation code. Please check your registration link.");
        if(referrer&&promo&&referrer.id!==promo.id)return fail(lang,"Invitation link and code belong to different people.");
        const name=typeof profile.name==="string"?profile.name:email.split("@")[0];
        user=await createUser({email,name,firstName:typeof profile.given_name==="string"?profile.given_name:undefined,lastName:typeof profile.family_name==="string"?profile.family_name:undefined,avatar:typeof profile.picture==="string"?profile.picture:undefined,googleId:profile.sub,authProvider:"google",credits:200,plan:"FREE",language:context.language||"en",accountType:accountTypeFor(context.selectedPlan,context.accountType),referralCode:await generateUniqueReferralCode(name),referredBy:promo?.id||referrer?.id});
        if(["/chat","/explore","/choose-plan"].includes(context.redirect||"")&&!context.selectedPlan&&context.accountType==="PERSONAL")user=await prisma.user.update({where:{id:user.id},data:{chatOnly:true,onboardingDone:true}});
        created=true;
        if(!user.chatOnly)contextual=await onAccountCreated(user.id,req.cookies.get(ANON_COOKIE)?.value,context.redirect,{selectedPlan:context.selectedPlan||undefined});
      }
    }
    if(user.isBlocked)return fail(lang,"Your account is blocked. Contact support.");
    await prisma.user.update({where:{id:user.id},data:{lastLoginAt:new Date()}});
    const payload={userId:user.id,role:user.role,plan:user.plan};
    const admin=["ADMIN","SUPER_ADMIN"].includes(user.role);
    const selected=context.selectedPlan?`?plan=${encodeURIComponent(context.selectedPlan)}&period=${context.period}`:"";
    const dest=admin?"/admin/dashboard":created?(user.chatOnly?(context.redirect||"/explore"):contextual||`/welcome${selected}`):context.redirect|| (context.selectedPlan?`/plans${selected}`:"/chat");
    const res=clearOAuth(NextResponse.redirect(`${publicAppUrl()}${dest}`));
    const secure=process.env.NODE_ENV==="production";
    res.cookies.set("token",signToken(payload),{httpOnly:true,secure,sameSite:"lax",maxAge:7*86400,path:"/"});
    res.cookies.set("refresh_token",signRefreshToken(payload),{httpOnly:true,secure,sameSite:"lax",maxAge:30*86400,path:"/"});
    if(user.language)res.cookies.set("lang",user.language,{secure,sameSite:"lax",maxAge:365*86400,path:"/"});
    return res;
  }catch {console.error("Google OAuth callback failed; verify provider configuration and connectivity");return fail(lang,"Google sign-in failed. Please retry or contact support.");}
}
