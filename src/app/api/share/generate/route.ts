import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { randomBytes } from "crypto";

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return unauthorizedResponse();

  const { type, id } = await req.json();

  const token = randomBytes(16).toString("hex");

  if (type === "business-analysis") {
    const record = await prisma.businessAnalysis.findUnique({ where: { id } });
    if (!record || record.userId !== auth.id)
      return NextResponse.json({ error: "not_found" }, { status: 404 });

    // Return existing token or create new one
    if (record.shareToken) return NextResponse.json({ token: record.shareToken });

    await prisma.businessAnalysis.update({ where: { id }, data: { shareToken: token } });
    return NextResponse.json({ token });
  }

  if (type === "content-pipeline") {
    const record = await prisma.contentPipelineRun.findUnique({ where: { id } });
    if (!record || record.userId !== auth.id)
      return NextResponse.json({ error: "not_found" }, { status: 404 });

    if (record.shareToken) return NextResponse.json({ token: record.shareToken });

    await prisma.contentPipelineRun.update({ where: { id }, data: { shareToken: token } });
    return NextResponse.json({ token });
  }

  return NextResponse.json({ error: "invalid_type" }, { status: 400 });
}
