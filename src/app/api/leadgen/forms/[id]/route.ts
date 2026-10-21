export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse, forbiddenResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { parseFields, serializeFields, LEAD_FIELD_KEYS } from "@/lib/leadgen/fields";

async function ownForm(userId: string, id: string) {
  return prisma.leadForm.findFirst({ where: { id, userId } });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  if (user.plan === "FREE") return forbiddenResponse();

  const form = await ownForm(user.id, params.id);
  if (!form) return NextResponse.json({ error: "فرم یافت نشد" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "درخواست نامعتبر" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim().slice(0, 120);
  for (const k of ["titleEn", "titleDe", "description", "descriptionEn", "descriptionDe", "logoUrl", "submitLabel", "successMessage", "redirectUrl"]) {
    if (k in body) data[k] = body[k]?.toString().trim() || null;
  }
  if (typeof body.accentColor === "string" && /^#[0-9a-fA-F]{6}$/.test(body.accentColor)) data.accentColor = body.accentColor;
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;

  if (body.fields && typeof body.fields === "object") {
    // Re-parse through the canonical shape so only the five fixed keys and
    // the two boolean flags can ever be stored.
    const merged = parseFields(form.fields);
    for (const key of LEAD_FIELD_KEYS) {
      const incoming = body.fields[key];
      if (incoming && typeof incoming === "object") {
        if (typeof incoming.show === "boolean") merged[key].show = incoming.show;
        if (typeof incoming.required === "boolean") merged[key].required = incoming.required;
      }
    }
    data.fields = serializeFields(parseFields(serializeFields(merged)));
  }

  await prisma.leadForm.update({ where: { id: form.id }, data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  if (user.plan === "FREE") return forbiddenResponse();

  const form = await ownForm(user.id, params.id);
  if (!form) return NextResponse.json({ error: "فرم یافت نشد" }, { status: 404 });

  // Submissions cascade (onDelete: Cascade). The CrmContacts already created
  // are intentionally left in the tenant's CRM — deleting a form must not
  // delete leads it already produced.
  await prisma.leadForm.delete({ where: { id: form.id } });
  return NextResponse.json({ ok: true });
}
