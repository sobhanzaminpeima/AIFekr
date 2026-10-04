export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { uploadToStorage, getStorageKey, StorageNotConfiguredError } from "@/lib/storage/r2";
import { studentWorkspaceDisabledResponse } from "@/lib/student/access";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return unauthorizedResponse(req);
  const unavailable = await studentWorkspaceDisabledResponse(auth);
  if (unavailable) return unavailable;
  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: "فایل تصویر معتبر نیست" }, { status: 400 }); }
  const file = form.get("file");
  if (!(file instanceof File) || !ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: "فقط تصویر JPG، PNG یا WebP پذیرفته می‌شود" }, { status: 415 });
  if (file.size <= 0 || file.size > MAX_AVATAR_BYTES) return NextResponse.json({ error: "حجم تصویر باید حداکثر ۵ مگابایت باشد" }, { status: 413 });
  try {
    const sharp = (await import("sharp")).default;
    const image = await sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 25_000_000 }).rotate().resize(512, 512, { fit: "cover", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
    const key = getStorageKey(auth.id, "image", `student-${crypto.randomUUID()}.webp`);
    const avatar = await uploadToStorage(image, key, "image/webp");
    const user = await prisma.user.update({ where: { id: auth.id }, data: { avatar }, select: { avatar: true } });
    return NextResponse.json({ avatar: user.avatar });
  } catch (error) {
    if (error instanceof StorageNotConfiguredError) return NextResponse.json({ error: "ذخیره‌سازی تصویر روی سرور تنظیم نشده است؛ مدیر باید تنظیمات R2 را کامل کند" }, { status: 503 });
    console.error("student avatar upload failed", error);
    return NextResponse.json({ error: "بارگذاری تصویر ناموفق بود" }, { status: 422 });
  }
}
