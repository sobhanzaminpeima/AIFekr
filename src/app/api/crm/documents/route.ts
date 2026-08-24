export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { uploadToStorage, getStorageKey, deleteFromStorage } from "@/lib/storage/r2";
import { resolveCrmWorkspace } from "@/lib/crm/workspace";
import { isModuleEnabled } from "@/lib/industry/moduleAccess";

async function checkPropertyDocsModuleAccess(userId: string, role: string, workspaceUserId: string) {
  const owner = await prisma.user.findUnique({ where: { id: workspaceUserId }, select: { industryPackId: true } });
  return isModuleEnabled({ id: userId, role, industryPackId: owner?.industryPackId ?? null }, "crm.propertyDocuments");
}

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
  const ws = await resolveCrmWorkspace(user.id);

  const { searchParams } = new URL(req.url);
  const contactId = searchParams.get("contactId");
  const dealId = searchParams.get("dealId");
  const propertyId = searchParams.get("propertyId");

  if (propertyId && !(await checkPropertyDocsModuleAccess(user.id, user.role, ws.workspaceUserId))) {
    return NextResponse.json({ error: "این ماژول برای شما فعال نیست" }, { status: 403 });
  }

  if (ws.isAgentRestricted) {
    if (contactId) {
      const owned = await prisma.crmContact.findFirst({ where: { id: contactId, userId: ws.workspaceUserId, assignedToId: ws.actingUserId } });
      if (!owned) return NextResponse.json({ documents: [] });
    } else if (dealId) {
      const owned = await prisma.crmDeal.findFirst({ where: { id: dealId, userId: ws.workspaceUserId, ownerId: ws.actingUserId } });
      if (!owned) return NextResponse.json({ documents: [] });
    } else if (propertyId) {
      const owned = await prisma.property.findFirst({ where: { id: propertyId, userId: ws.workspaceUserId, crmContact: { assignedToId: ws.actingUserId } } });
      if (!owned) return NextResponse.json({ documents: [] });
    } else {
      return NextResponse.json({ documents: [] });
    }
  }

  const documents = await prisma.crmDocument.findMany({
    where: {
      userId: ws.workspaceUserId,
      ...(contactId ? { contactId } : {}),
      ...(dealId ? { dealId } : {}),
      ...(propertyId ? { propertyId } : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  // Never hand out the raw stored link — it's either a public R2_PUBLIC_URL
  // (readable by anyone who gets it) or a long-lived presigned URL (7 days,
  // no re-auth). Each document is instead fetched through the authenticated
  // /download route, which mints a fresh ~1-minute signed URL per request.
  return NextResponse.json({ documents: documents.map(({ fileUrl: _fileUrl, storageKey: _storageKey, ...d }) => d) });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);

  const form = await req.formData();
  const file = form.get("file");
  const contactId = form.get("contactId") as string | null;
  const dealId = form.get("dealId") as string | null;
  const propertyId = form.get("propertyId") as string | null;
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

  if (propertyId && !(await checkPropertyDocsModuleAccess(user.id, user.role, ws.workspaceUserId))) {
    return NextResponse.json({ error: "این ماژول برای شما فعال نیست" }, { status: 403 });
  }

  // A document must attach to something in this workspace — and, for an AGENT, to a record assigned to them.
  if (contactId) {
    const contact = await prisma.crmContact.findFirst({ where: { id: contactId, userId: ws.workspaceUserId, ...(ws.isAgentRestricted ? { assignedToId: ws.actingUserId } : {}) } });
    if (!contact) return NextResponse.json({ error: "مخاطب یافت نشد" }, { status: 404 });
  }
  if (dealId) {
    const deal = await prisma.crmDeal.findFirst({ where: { id: dealId, userId: ws.workspaceUserId, ...(ws.isAgentRestricted ? { ownerId: ws.actingUserId } : {}) } });
    if (!deal) return NextResponse.json({ error: "معامله یافت نشد" }, { status: 404 });
  }
  if (propertyId) {
    const property = await prisma.property.findFirst({ where: { id: propertyId, userId: ws.workspaceUserId, ...(ws.isAgentRestricted ? { crmContact: { assignedToId: ws.actingUserId } } : {}) } });
    if (!property) return NextResponse.json({ error: "ملک یافت نشد" }, { status: 404 });
  }
  if (!contactId && !dealId && !propertyId) {
    return NextResponse.json({ error: "سند باید به یک مخاطب، معامله یا ملک متصل باشد" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const key = getStorageKey(ws.workspaceUserId, "document", file.name);
  const fileUrl = await uploadToStorage(buf, key, file.type);

  const document = await prisma.crmDocument.create({
    data: { userId: ws.workspaceUserId, contactId: contactId || undefined, dealId: dealId || undefined, propertyId: propertyId || undefined, name, type, fileUrl, storageKey: key },
  });
  const { fileUrl: _fileUrl, storageKey: _storageKey, ...documentWithoutUrl } = document;
  return NextResponse.json({ document: documentWithoutUrl });
}

export async function DELETE(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);

  const { id } = await req.json();
  const existing = await prisma.crmDocument.findFirst({
    where: {
      id, userId: ws.workspaceUserId,
      ...(ws.isAgentRestricted ? { OR: [{ contact: { assignedToId: ws.actingUserId } }, { deal: { ownerId: ws.actingUserId } }, { property: { crmContact: { assignedToId: ws.actingUserId } } }] } : {}),
    },
  });
  if (!existing) return NextResponse.json({ error: "پیدا نشد" }, { status: 404 });

  await prisma.crmDocument.delete({ where: { id } });
  if (existing.storageKey) await deleteFromStorage(existing.storageKey).catch((err) => console.error("R2 delete failed (non-fatal, DB row already removed):", err));
  return NextResponse.json({ success: true });
}
