export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { uploadToStorage, getStorageKey, StorageNotConfiguredError } from "@/lib/storage/r2";

/**
 * Public, no-login upload for the shared 1980s prompt page -- deliberately
 * separate from /api/upload (which requires auth) rather than relaxing that
 * one, so an authenticated upload path never accidentally becomes public.
 * Gated by the same signed-cookie free-use counter as
 * /api/public/generate-1980s: a visitor who has already used their 2 free
 * generations can't keep uploading photos indefinitely either.
 */

const FREE_USES = 1;
const COOKIE_NAME = "aifekr_public_1980s_uses";
const COOKIE_SECRET = process.env.JWT_SECRET || "dev-fallback-do-not-use-in-prod";
const MAX_SIZE_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function verify(value: string | undefined): number {
  if (!value) return 0;
  const [countStr, mac] = value.split(".");
  const count = parseInt(countStr, 10);
  if (!Number.isFinite(count) || count < 0) return 0;
  const expected = crypto.createHmac("sha256", COOKIE_SECRET).update(String(count)).digest("hex").slice(0, 16);
  return mac === expected ? count : FREE_USES;
}

export async function POST(req: NextRequest) {
  const uses = verify(req.cookies.get(COOKIE_NAME)?.value);
  if (uses >= FREE_USES) {
    return NextResponse.json({ error: "تعداد رایگان تمام شد", limitReached: true, redirectTo: "/plans" }, { status: 402 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "فایلی ارسال نشد" }, { status: 400 });
  if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: "فقط تصاویر JPG، PNG یا WebP مجاز است" }, { status: 400 });
  if (file.size > MAX_SIZE_BYTES) return NextResponse.json({ error: "حجم فایل نباید بیشتر از ۸ مگابایت باشد" }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const key = getStorageKey("public-share", "reference", `ref.${ext}`);
  try {
    const url = await uploadToStorage(buf, key, file.type);
    return NextResponse.json({ url });
  } catch (e) {
    if (e instanceof StorageNotConfiguredError) {
      console.error("public upload falling back to data URI (storage not configured):", e.message);
      return NextResponse.json({ url: `data:${file.type};base64,${buf.toString("base64")}` });
    }
    throw e;
  }
}
