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
import { resolvePromo } from "@/lib/utils/referralPromo";
function clearOAuth(response:NextResponse) {
  for(const key of ["google_oauth_state","google_oauth_context"]) response.cookies.set(key,"",{maxAge:0,path:"/"});
  return response;
}
function fail(reason:string) { return clearOAuth(NextResponse.redirect(`${publicAppUrl()}/login?error=${encodeURIComponent(reason)}`)); }
export async function GET(req:NextRequest) {
  const code=req.nextUrl.searchParams.get("code");
  const state=req.nextUrl.searchParams.get("state");
  const saved=req.cookies.get("google_oauth_state")?.value;
  if(!state||!saved||Buffer.byteLength(state)!==Buffer.byteLength(saved)||!timingSafeEqual(Buffer.from(state),Buffer.from(saved)))return fail("Invalid Google sign-in request. Please try again.");
  if(req.nextUrl.searchParams.get("error"))return fail("Google sign-in was cancelled. Please try again.");
  if(!code)return fail("Google authorization code is missing.");
  const clientId=process.env.GOOGLE_CLIENT_ID,clientSecret=process.env.GOOGLE_CLIENT_SECRET;
  if(!clientId||!clientSecret)return fail("Google sign-in is not configured.");
  const context=readGoogleContext(req.cookies.get("google_oauth_context")?.value);
  try {
    const tokenRes=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({code,client_id:clientId,client_secret:clientSecret,redirect_uri:`${publicAppUrl()}/api/auth/google/callback`,grant_type:"authorization_code"}),cache:"no-store",signal:AbortSignal.timeout(10000)});
    if(!tokenRes.ok)return fail("Google authorization failed. Please try again or contact support.");
    const tokens=await tokenRes.json();if(typeof tokens.access_token!=="string")return fail("Google authorization failed.");
    const profileRes=await fetch("https://openidconnect.googleapis.com/v1/userinfo",{headers:{Authorization:`Bearer ${tokens.access_token}`},cache:"no-store",signal:AbortSignal.timeout(10000)});
    if(!profileRes.ok)return fail("Unable to load your Google profile.");
    const profile=await profileRes.json();
    if(typeof profile.sub!=="string"||!profile.sub||typeof profile.email!=="string"||profile.email_verified!==true)return fail("Use a Google account with a verified email address.");
    const email=profile.email.trim().toLowerCase();
    let user=await prisma.user.findUnique({where:{googleId:profile.sub}});
    let created=false;
    if(!user){
      user=await prisma.user.findUnique({where:{email}});
      if(user){
        if(user.isBlocked)return fail("Your account is blocked. Contact support.");
        if(user.googleId&&user.googleId!==profile.sub)return fail("This email is linked to another Google account. Contact support.");
        user=await prisma.user.update({where:{id:user.id},data:{googleId:profile.sub,authProvider:"google",avatar:user.avatar||profile.picture}});
      } else {
        const referrer=context.ref?await findUserByReferralCode(context.ref):null;
        const promo=context.promoCode?await resolvePromo(context.promoCode):null;
        if(context.promoCode&&!promo)return fail("Invalid invitation code. Please check your registration link.");
        if(referrer&&promo&&referrer.id!==promo.id)return fail("Invitation link and code belong to different people.");
        const name=typeof profile.name==="string"?profile.name:email.split("@")[0];
        user=await createUser({email,name,firstName:typeof profile.given_name==="string"?profile.given_name:undefined,lastName:typeof profile.family_name==="string"?profile.family_name:undefined,avatar:typeof profile.picture==="string"?profile.picture:undefined,googleId:profile.sub,authProvider:"google",credits:200,plan:"FREE",language:context.language||"en",accountType:accountTypeFor(context.selectedPlan,context.accountType),referralCode:await generateUniqueReferralCode(name),referredBy:promo?.id||referrer?.id});
        created=true;
      }
    }
    if(user.isBlocked)return fail("Your account is blocked. Contact support.");
    await prisma.user.update({where:{id:user.id},data:{lastLoginAt:new Date()}});
    const payload={userId:user.id,role:user.role,plan:user.plan};
    const admin=["ADMIN","SUPER_ADMIN"].includes(user.role);
    const selected=context.selectedPlan?`?plan=${encodeURIComponent(context.selectedPlan)}&period=${context.period}`:"";
    const dest=admin?"/admin/dashboard":created?`/welcome${selected}`:context.redirect|| (context.selectedPlan?`/plans${selected}`:"/chat");
    const res=clearOAuth(NextResponse.redirect(`${publicAppUrl()}${dest}`));
    const secure=process.env.NODE_ENV==="production";
    res.cookies.set("token",signToken(payload),{httpOnly:true,secure,sameSite:"lax",maxAge:7*86400,path:"/"});
    res.cookies.set("refresh_token",signRefreshToken(payload),{httpOnly:true,secure,sameSite:"lax",maxAge:30*86400,path:"/"});
    if(user.language)res.cookies.set("lang",user.language,{secure,sameSite:"lax",maxAge:365*86400,path:"/"});
    return res;
  }catch {console.error("Google OAuth callback failed; verify provider configuration and connectivity");return fail("Google sign-in failed. Please retry or contact support.");}
}
