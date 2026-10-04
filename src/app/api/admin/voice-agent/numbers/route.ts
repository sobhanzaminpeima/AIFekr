export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, forbiddenResponse } from "@/lib/auth/middleware";
import { listPhoneNumbers } from "@/lib/voice/vapiClient";
import { prisma } from "@/lib/db/prisma";
export async function GET(req: NextRequest) {
  if (!await requireAdmin(req)) return forbiddenResponse();
  try {
    const [numbers, agents] = await Promise.all([listPhoneNumbers(), prisma.voiceAgent.findMany({ select: {id:true,userId:true,name:true,phoneNumber:true,vapiPhoneNumberId:true,user:{select:{name:true,email:true}}} })]);
    return NextResponse.json({ numbers: numbers.map(n=>({id:n.id,number:n.number})), agents });
  } catch { return NextResponse.json({error:"اتصال Vapi انجام نشد؛ کلید خصوصی و موجودی حساب را بررسی کنید."},{status:502}); }
}
