export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse, forbiddenResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { DEFAULT_FIELDS, parseFields, serializeFields } from "@/lib/leadgen/fields";
import { makeSlug } from "@/lib/leadgen/repository";
import { activeBusinessIdFor } from "@/lib/organization/activeBusiness";
import { bizScope } from "@/lib/accounting/scope";

// Tenant-facing Lead Generation module. Gated on a paid AI plan (user.plan
// !== "FREE"); a lapsed plan is already downgraded to FREE by requireAuth.
const MAX_FORMS_PER_TENANT = 50;

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  if (user.plan === "FREE") return forbiddenResponse();

  const businessId = await activeBusinessIdFor(user.id);
  const forms = await prisma.leadForm.findMany({
    where: { userId: user.id, ...bizScope(businessId) },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { submissions: true } } },
  });

  return NextResponse.json({
    forms: forms.map((f) => ({
      id: f.id,
      slug: f.slug,
      title: f.title,
      titleEn: f.titleEn,
      titleDe: f.titleDe,
      description: f.description,
      descriptionEn: f.descriptionEn,
      descriptionDe: f.descriptionDe,
      fields: parseFields(f.fields),
      accentColor: f.accentColor,
      logoUrl: f.logoUrl,
      submitLabel: f.submitLabel,
      successMessage: f.successMessage,
      redirectUrl: f.redirectUrl,
      isActive: f.isActive,
      submissionCount: f._count.submissions,
      createdAt: f.createdAt,
    })),
  });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  if (user.plan === "FREE") return forbiddenResponse();

  const count = await prisma.leadForm.count({ where: { userId: user.id } });
  if (count >= MAX_FORMS_PER_TENANT) {
    return NextResponse.json({ error: "به سقف تعداد فرم رسیده‌اید" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  if (!body || !body.title?.trim()) {
    return NextResponse.json({ error: "عنوان فرم الزامی است" }, { status: 400 });
  }

  const title = String(body.title).trim().slice(0, 120);
  let slug = makeSlug(title);
  // makeSlug already adds a random suffix, but guard against the rare collision.
  for (let i = 0; i < 5; i++) {
    const exists = await prisma.leadForm.findUnique({ where: { slug } });
    if (!exists) break;
    slug = makeSlug(title);
  }

  const form = await prisma.leadForm.create({
    data: {
      userId: user.id,
      businessId: await activeBusinessIdFor(user.id),
      slug,
      title,
      titleEn: body.titleEn?.trim() || null,
      titleDe: body.titleDe?.trim() || null,
      description: body.description?.trim() || null,
      descriptionEn: body.descriptionEn?.trim() || null,
      descriptionDe: body.descriptionDe?.trim() || null,
      fields: serializeFields(DEFAULT_FIELDS),
      accentColor: typeof body.accentColor === "string" && /^#[0-9a-fA-F]{6}$/.test(body.accentColor) ? body.accentColor : "#ea580c",
      logoUrl: body.logoUrl?.trim() || null,
      submitLabel: body.submitLabel?.trim() || null,
      successMessage: body.successMessage?.trim() || null,
      redirectUrl: body.redirectUrl?.trim() || null,
      isActive: true,
    },
  });

  return NextResponse.json({ id: form.id, slug: form.slug });
}
