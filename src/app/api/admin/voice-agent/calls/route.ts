export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, forbiddenResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
export async function GET(req: NextRequest) {
  if (!await requireAdmin(req)) return forbiddenResponse();
  const calls=await prisma.voiceCallLog.findMany({orderBy:{createdAt:"desc"},take:50,select:{id:true,vapiCallId:true,callerPhone:true,status:true,billingStatus:true,reservedCredits:true,creditsCharged:true,cost:true,durationSec:true,createdAt:true,agent:{select:{name:true}},user:{select:{name:true,email:true}}}});
  return NextResponse.json({calls});
}
