export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { uploadToStorage, getStorageKey } from "@/lib/storage/r2";

const MAX_SIZE_BYTES = 15 * 1024 * 1024; // 15MB — bigger than the image-only /api/upload cap since these are quotes/contracts/invoices
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg", "image/png", "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { searchParams } = new URL(req.url);
  const contactId = searchParams.get("contactId");
  const dealId = searchParams.get("dealId");

  const documents = await prisma.crmDocument.findMany({
    where: {
      userId: user.id,
      ...(contactId ? { contactId } : {}),
      ...(dealId ? { dealId } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ documents });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const form = await req.formData();
  const file = form.get("file");
  const contactId = form.get("contactId") as string | null;
  const dealId = form.get("dealId") as string | null;
  const type = (form.get("type") as string) || "attachment";
  const name = (form.get("name") as string) || (file instanceof File ? file.name : "سند");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "فایلی ارسال نشد" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "نوع فایل پشتیبانی نمی‌شود (PDF، تصویر، Word یا Excel مجاز است)" }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "حجم فایل نباید بیشتر از ۱۵ مگابایت باشد" }, { status: 400 });
  }

  // A document must attach to something this user actually owns.
  if (contactId) {
    const contact = await prisma.crmContact.findFirst({ where: { id: contactId, userId: user.id } });
    if (!contact) return NextResponse.json({ error: "مخاطب یافت نشد" }, { status: 404 });
  }
  if (dealId) {
    const deal = await prisma.crmDeal.findFirst({ where: { id: dealId, userId: user.id } });
    if (!deal) return NextResponse.json({ error: "معامله یافت نشد" }, { status: 404 });
  }
  if (!contactId && !dealId) {
    return NextResponse.json({ error: "سند باید به یک مخاطب یا معامله متصل باشد" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const key = getStorageKey(user.id, "document", file.name);
  const fileUrl = await uploadToStorage(buf, key, file.type);

  const document = await prisma.crmDocument.create({
    data: { userId: user.id, contactId: contactId || undefined, dealId: dealId || undefined, name, type, fileUrl },
  });
  return NextResponse.json({ document });
}

export async function DELETE(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { id } = await req.json();
  const existing = await prisma.crmDocument.findFirst({ where: { id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: "پیدا نشد" }, { status: 404 });

  await prisma.crmDocument.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
