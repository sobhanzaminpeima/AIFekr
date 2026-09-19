export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse, forbiddenResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { notify } from "@/lib/notifications/create";
import { activeBusinessIdFor } from "@/lib/organization/activeBusiness";

// Used while the Meta app has no App Review / Advanced Access for
// leads_retrieval: instead of running the OAuth flow (which only works for
// people with a role on the app), the tenant files a request and an admin
// wires up their Page token by hand from /admin/lead-connectors.
export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  if (user.plan === "FREE") return forbiddenResponse();

  const body = await req.json().catch(() => ({}));
  const pageName = typeof body.pageName === "string" ? body.pageName.trim().slice(0, 120) : "";
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";

  const existing = await prisma.leadSource.findFirst({
    where: { userId: user.id, provider: "meta", status: { in: ["pending", "active"] } },
  });
  if (existing && existing.status === "active") {
    return NextResponse.json({ error: "already_connected" }, { status: 400 });
  }

  const src = existing
    ? await prisma.leadSource.update({
        where: { id: existing.id },
        data: { name: pageName || existing.name, lastError: note || null, status: "pending" },
      })
    : await prisma.leadSource.create({
        data: {
          userId: user.id,
          businessId: await activeBusinessIdFor(user.id),
          provider: "meta",
          externalId: "pending",
          name: pageName || "Meta (در انتظار اتصال)",
          status: "pending",
          lastError: note || null,
        },
      });

  const admins = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
    select: { id: true },
  });
  await Promise.all(
    admins.map((a) =>
      notify(a.id, {
        type: "lead_connector_request",
        title: "درخواست اتصال Meta Lead Ads",
        body: `${user.name || user.email} می‌خواهد پیج «${pageName || "?"}» را وصل کند.${note ? ` یادداشت: ${note}` : ""}`,
        link: "/admin/lead-connectors",
      })
    )
  );

  return NextResponse.json({ ok: true, id: src.id });
}
