"use client";

/**
 * Client-side image downscale + recompress, run BEFORE upload.
 *
 * The upload path stores reference photos either in R2 or (when R2 isn't
 * configured) as a base64 data URI that then travels back to the browser,
 * into React state, back to /api/image/generate in the request body, and
 * into SQLite. Every one of those hops scales with the file's byte size, so
 * an untouched 8 MB phone photo makes the whole flow feel slow. A reference
 * image for AI image/video generation never needs to be larger than ~1600 px
 * on its long edge (OpenAI's edit endpoint works at 1024), so shrinking it
 * here turns a multi-megabyte upload into a few hundred KB with no visible
 * quality loss.
 *
 * Best-effort: any failure (decode error, no canvas, already small) returns
 * the original File untouched so a caller can always just `await` this.
 */
export async function downscaleImage(
  file: File,
  opts: { maxEdge?: number; quality?: number; skipBelowBytes?: number } = {}
): Promise<File> {
  const maxEdge = opts.maxEdge ?? 1600;
  const quality = opts.quality ?? 0.85;
  const skipBelowBytes = opts.skipBelowBytes ?? 500 * 1024; // 500 KB

  if (typeof document === "undefined") return file;
  if (!file.type.startsWith("image/")) return file;
  // Nothing to gain on already-small files, and re-encoding a PNG (e.g. a
  // logo/screenshot) to JPEG could hurt more than the size saves.
  if (file.size <= skipBelowBytes) return file;

  try {
    const bitmap = await loadBitmap(file);
    const { width, height } = bitmap;
    const scale = Math.min(1, maxEdge / Math.max(width, height));
    // Small file that's also small in dimensions — leave it alone.
    if (scale === 1 && file.size <= skipBelowBytes) {
      closeBitmap(bitmap);
      return file;
    }

    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      closeBitmap(bitmap);
      return file;
    }
    ctx.drawImage(bitmap as CanvasImageSource, 0, 0, targetW, targetH);
    closeBitmap(bitmap);

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    );
    if (!blob || blob.size >= file.size) return file; // no win — keep original

    const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], newName, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  }
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // fall through to <img> decode
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } finally {
    // The <img> keeps its own copy of the pixels after decode(); safe to revoke.
    URL.revokeObjectURL(url);
  }
}

function closeBitmap(b: ImageBitmap | HTMLImageElement) {
  if (typeof ImageBitmap !== "undefined" && b instanceof ImageBitmap) b.close();
}
