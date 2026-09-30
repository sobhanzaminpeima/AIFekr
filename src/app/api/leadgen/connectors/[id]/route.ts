export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse, forbiddenResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { metaUnsubscribePageLeadgen } from "@/lib/leadgen/meta";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  if (user.plan === "FREE") return forbiddenResponse();

  const src = await prisma.leadSource.findFirst({ where: { id: params.id, userId: user.id } });
  if (!src) return NextResponse.json({ error: "یافت نشد" }, { status: 404 });

  // Best-effort: drop the Page's leadgen webhook subscription. A failure here
  // (relay down, token expired) shouldn't block removing the row.
  if (src.provider === "meta" && src.accessToken) {
    await metaUnsubscribePageLeadgen(src.externalId, src.accessToken).catch(() => {});
  }

  await prisma.leadSource.delete({ where: { id: src.id } });
  return NextResponse.json({ ok: true });
}
