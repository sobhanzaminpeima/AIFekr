export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { uploadToStorage, getStorageKey, StorageNotConfiguredError } from "@/lib/storage/r2";

const MAX_SIZE_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Generic authenticated reference-photo upload — used by the image and
 * video generation tools so a user's own uploaded photo can be passed as a
 * source image to the AI (image-to-image / image-to-video), separate from
 * the AI-generated output files those tools already upload themselves.
 */
export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "فایلی ارسال نشد" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "فقط تصاویر JPG، PNG یا WebP مجاز است" }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "حجم فایل نباید بیشتر از ۸ مگابایت باشد" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const key = getStorageKey(user.id, "reference", `ref.${ext}`);
  try {
    const url = await uploadToStorage(buf, key, file.type);
    return NextResponse.json({ url });
  } catch (e) {
    if (e instanceof StorageNotConfiguredError) {
      // Same fallback every other upload path in the app already applies
      // (see /api/image/generate and /api/image/character-board) when R2
      // isn't configured -- without this, EVERY "upload your own photo"
      // reference-image flow (image-to-image, image-to-video, Character
      // Creator step 1) hard-fails with a 503 instead of degrading.
      console.error("upload falling back to data URI (storage not configured):", e.message);
      const url = `data:${file.type};base64,${buf.toString("base64")}`;
      return NextResponse.json({ url });
    }
    throw e;
  }
}
