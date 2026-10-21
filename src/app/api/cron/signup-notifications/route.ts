import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/auth/cronAuth";
import { deliverSignupNotifications } from "@/lib/email/signupNotifications";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) return NextResponse.json({error:"Unauthorized"},{status:401});
  return NextResponse.json(await deliverSignupNotifications());
}
