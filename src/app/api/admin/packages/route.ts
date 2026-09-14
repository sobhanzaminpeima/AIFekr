export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

async function checkAdmin(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) {
    const { requireAuth } = await import("@/lib/auth/middleware");
    const user = await requireAuth(req);
    return user ? forbiddenResponse() : unauthorizedResponse();
  }
  return null;
}

export async function GET(req: NextRequest) {
  const err = await checkAdmin(req); if (err) return err;
  try {
    const packages = await prisma.package.findMany({ orderBy: { sortOrder: "asc" } });
    return NextResponse.json({ packages });
  } catch (e) { return NextResponse.json({ error: "خطای سرور" }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  const err = await checkAdmin(req); if (err) return err;
  try {
    const body = await req.json();
    if (!body.planCode) return NextResponse.json({ error: "planCode الزامی است" }, { status: 400 });
    const pkg = await prisma.package.create({
      data: {
        planCode: body.planCode,
        name: body.name, nameEn: body.nameEn || body.name,
        price: Number(body.price) || 0,
        // priceUsd/market/featuresEn exist on the model and drive the whole
        // international side of /plans, but this route never read them -- so an
        // international package could not be created or priced from the admin
        // panel at all, and its card rendered as "free" (QA 2026-09-15, A03).
        // Null, not 0: null means "Iran-only plan" per the schema, while 0
        // would advertise a genuinely free USD plan.
        priceUsd: body.priceUsd === "" || body.priceUsd == null ? null : Number(body.priceUsd),
        market: body.market || "IR",
        duration: Number(body.duration) || 30,
        credits: Number(body.credits) || 1000,
        features: body.features || "",
        featuresEn: body.featuresEn || null,
        color: body.color || "#ea580c",
        isActive: body.isActive ?? true,
        isFeatured: body.isFeatured ?? false,
        sortOrder: Number(body.sortOrder) || 0,
      },
    });
    return NextResponse.json({ package: pkg });
  } catch (e: any) {
    if (e?.code === "P2002") return NextResponse.json({ error: "این کد پلن قبلاً استفاده شده" }, { status: 400 });
    return NextResponse.json({ error: "خطا در ایجاد پکیج" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const err = await checkAdmin(req); if (err) return err;
  try {
    const body = await req.json();
    const { id, ...data } = body;
    if (!id) return NextResponse.json({ error: "id الزامی است" }, { status: 400 });
    const pkg = await prisma.package.update({
      where: { id },
      data: {
        name: data.name, nameEn: data.nameEn,
        price: Number(data.price),
        // See the POST handler's note -- same three fields were unwritable here.
        priceUsd: data.priceUsd === "" || data.priceUsd == null ? null : Number(data.priceUsd),
        market: data.market || "IR",
        duration: Number(data.duration),
        credits: Number(data.credits),
        features: data.features,
        featuresEn: data.featuresEn || null,
        color: data.color,
        isActive: data.isActive,
        isFeatured: data.isFeatured,
        sortOrder: Number(data.sortOrder) || 0,
      },
    });
    return NextResponse.json({ package: pkg });
  } catch (e) { return NextResponse.json({ error: "خطا در ویرایش" }, { status: 500 }); }
}

export async function PATCH(req: NextRequest) {
  const err = await checkAdmin(req); if (err) return err;
  try {
    const { id, ...data } = await req.json();
    const pkg = await prisma.package.update({ where: { id }, data });
    return NextResponse.json({ package: pkg });
  } catch (e) { return NextResponse.json({ error: "خطا" }, { status: 500 }); }
}

export async function DELETE(req: NextRequest) {
  const err = await checkAdmin(req); if (err) return err;
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id الزامی است" }, { status: 400 });
    await prisma.package.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) { return NextResponse.json({ error: "خطا در حذف" }, { status: 500 }); }
}