import { NextResponse } from "next/server";
import { OWNER_COOKIE } from "@/lib/auth/ownerAuth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(OWNER_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
