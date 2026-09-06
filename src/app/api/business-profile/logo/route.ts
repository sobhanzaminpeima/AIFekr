export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { uploadToStorage, getStorageKey, StorageNotConfiguredError } from "@/lib/storage/r2";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n/tri";

/**
 * Company logo upload (Business Doctor). Stored on Company.logoUrl, keyed
 * by the owning user — the same row every invoice/contract/payslip/owner-
 * statement print already reads through resolveCrmWorkspace()'s
 * workspaceUserId, so uploading here makes the logo show up everywhere
 * without any per-document setup.
 */

const MAX_SIZE_BYTES = 4 * 1024 * 1024; // 4MB — a logo, not a photo
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/svg+xml"]);

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const lang = await getServerLang();

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: tri(lang, "فایلی ارسال نشد", "No file was sent", "Es wurde keine Datei gesendet") }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: tri(lang, "فقط تصویر JPEG، PNG، WebP یا SVG مجاز است", "Only JPEG, PNG, WebP, or SVG images are allowed", "Nur JPEG-, PNG-, WebP- oder SVG-Bilder sind erlaubt") }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: tri(lang, "حجم لوگو نباید بیشتر از ۴ مگابایت باشد", "Logo size must not exceed 4MB", "Die Logogröße darf 4 MB nicht überschreiten") }, { status: 400 });
  }

  const company = await prisma.company.findUnique({ where: { userId: user.id } });
  if (!company) {
    return NextResponse.json({ error: tri(lang, "ابتدا پروفایل کسب‌وکار را تکمیل کنید", "Complete your business profile first", "Vervollständigen Sie zuerst Ihr Unternehmensprofil") }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : file.type === "image/svg+xml" ? "svg" : "jpg";
  const key = getStorageKey(user.id, "image", `logo.${ext}`);

  let url: string;
  try {
    url = await uploadToStorage(buf, key, file.type);
  } catch (e) {
    if (e instanceof StorageNotConfiguredError) {
      console.error("logo upload rejected:", e.message);
      return NextResponse.json({ error: tri(lang,
        "فضای ذخیره‌سازی فایل هنوز پیکربندی نشده است — با پشتیبانی تماس بگیرید.",
        "File storage is not configured yet — please contact support.",
        "Der Dateispeicher ist noch nicht konfiguriert — bitte kontaktieren Sie den Support.") }, { status: 503 });
    }
    throw e;
  }

  await prisma.company.update({ where: { userId: user.id }, data: { logoUrl: url } });

  return NextResponse.json({ logoUrl: url });
}

export async function DELETE(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const company = await prisma.company.findUnique({ where: { userId: user.id } });
  if (!company) return NextResponse.json({ success: true });

  await prisma.company.update({ where: { userId: user.id }, data: { logoUrl: null } });
  return NextResponse.json({ success: true });
}
