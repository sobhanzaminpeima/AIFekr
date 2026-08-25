export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { resolveCrmWorkspace, hasCrmAccess } from "@/lib/crm/workspace";
import { isModuleEnabled } from "@/lib/industry/moduleAccess";
import { uploadToStorage, getStorageKey } from "@/lib/storage/r2";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n";

const MAX_SIZE_BYTES = 8 * 1024 * 1024; // 8MB — photos only, smaller than the 15MB document cap
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

async function checkModuleAccess(userId: string, role: string, workspaceUserId: string) {
  const owner = await prisma.user.findUnique({ where: { id: workspaceUserId }, select: { industryPackId: true } });
  return isModuleEnabled({ id: userId, role, industryPackId: owner?.industryPackId ?? null }, "crm.property");
}

function parseImages(images: string | null): string[] {
  if (!images) return [];
  try {
    const parsed = JSON.parse(images);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });
  if (!(await checkModuleAccess(user.id, user.role, ws.workspaceUserId))) {
    return NextResponse.json({ error: tri(lang, "این ماژول برای شما فعال نیست", "This module is not enabled for you", "Dieses Modul ist für Sie nicht aktiviert") }, { status: 403 });
  }

  const property = await prisma.property.findFirst({ where: { id: params.id, userId: ws.workspaceUserId } });
  if (!property) return NextResponse.json({ error: tri(lang, "ملک یافت نشد", "Property not found", "Immobilie nicht gefunden") }, { status: 404 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: tri(lang, "فایلی ارسال نشد", "No file was sent", "Es wurde keine Datei gesendet") }, { status: 400 });
  if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: tri(lang, "فقط تصویر JPEG، PNG یا WebP مجاز است", "Only JPEG, PNG, or WebP images are allowed", "Nur JPEG-, PNG- oder WebP-Bilder sind erlaubt") }, { status: 400 });
  if (file.size > MAX_SIZE_BYTES) return NextResponse.json({ error: tri(lang, "حجم تصویر نباید بیشتر از ۸ مگابایت باشد", "Image size must not exceed 8MB", "Die Bildgröße darf 8 MB nicht überschreiten") }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const key = getStorageKey(ws.workspaceUserId, "image", file.name);
  const url = await uploadToStorage(buf, key, file.type);

  const images = parseImages(property.images);
  images.push(url);

  const updated = await prisma.property.update({ where: { id: params.id }, data: { images: JSON.stringify(images) } });
  return NextResponse.json({ images: parseImages(updated.images) });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });
  if (!(await checkModuleAccess(user.id, user.role, ws.workspaceUserId))) {
    return NextResponse.json({ error: tri(lang, "این ماژول برای شما فعال نیست", "This module is not enabled for you", "Dieses Modul ist für Sie nicht aktiviert") }, { status: 403 });
  }

  const property = await prisma.property.findFirst({ where: { id: params.id, userId: ws.workspaceUserId } });
  if (!property) return NextResponse.json({ error: tri(lang, "ملک یافت نشد", "Property not found", "Immobilie nicht gefunden") }, { status: 404 });

  const { url } = await req.json();
  const images = parseImages(property.images).filter((u) => u !== url);
  const updated = await prisma.property.update({ where: { id: params.id }, data: { images: JSON.stringify(images) } });
  return NextResponse.json({ images: parseImages(updated.images) });
}
