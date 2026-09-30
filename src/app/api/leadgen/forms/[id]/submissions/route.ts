export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse, forbiddenResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  if (user.plan === "FREE") return forbiddenResponse();

  const form = await prisma.leadForm.findFirst({ where: { id: params.id, userId: user.id } });
  if (!form) return NextResponse.json({ error: "فرم یافت نشد" }, { status: 404 });

  const subs = await prisma.leadFormSubmission.findMany({
    where: { formId: form.id },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({
    submissions: subs.map((s) => {
      let data: Record<string, string> = {};
      try {
        data = JSON.parse(s.data);
      } catch {
        data = {};
      }
      return {
        id: s.id,
        contactId: s.contactId,
        data,
        score: s.score,
        utmSource: s.utmSource,
        utmMedium: s.utmMedium,
        utmCampaign: s.utmCampaign,
        createdAt: s.createdAt,
      };
    }),
  });
}
