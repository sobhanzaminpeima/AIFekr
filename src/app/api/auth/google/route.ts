export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { publicAppUrl } from "@/lib/utils/publicAppUrl";
import { googleContext } from "@/lib/auth/googleContext";
export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId || !process.env.GOOGLE_CLIENT_SECRET) return NextResponse.redirect(`${publicAppUrl()}/login?error=Google%20sign-in%20is%20not%20configured`);
  const state = randomBytes(32).toString("hex");
  const context = googleContext(req.nextUrl.searchParams);
  if (!context.language) context.language = ["fa","en","de","tr"].includes(req.cookies.get("lang")?.value||"") ? req.cookies.get("lang")!.value : "en";
  const params = new URLSearchParams({client_id:clientId,redirect_uri:`${publicAppUrl()}/api/auth/google/callback`,response_type:"code",scope:"openid email profile",access_type:"online",prompt:"select_account",state});
  const response = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  const cookie = {httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax" as const,maxAge:600,path:"/"};
  response.cookies.set("google_oauth_state",state,cookie);
  response.cookies.set("google_oauth_context",JSON.stringify(context),cookie);
  return response;
}
