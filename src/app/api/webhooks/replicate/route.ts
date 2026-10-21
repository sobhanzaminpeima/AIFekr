export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db/prisma";
import { uploadToStorage, getStorageKey } from "@/lib/storage/r2";

/**
 * Replicate signs webhooks in the Svix format (same scheme Svix itself uses):
 * headers `webhook-id`, `webhook-timestamp`, `webhook-signature` (space-
 * separated "v1,<base64 hmac>" entries — Replicate rotates/adds signing
 * keys, so any one matching is valid), HMAC-SHA256 over
 * "{id}.{timestamp}.{rawBody}" using the base64 portion of the signing
 * secret (after its "whsec_" prefix).
 *
 * Left optional (passes when REPLICATE_WEBHOOK_SECRET is unset), matching
 * the same pattern as the Vapi webhook's verifySecret — so this route still
 * works before a signing secret has been configured in Replicate's
 * dashboard, but is properly locked down once one is set.
 */
function verifySignature(rawBody: string, headers: Headers): boolean {
  const secret = process.env.REPLICATE_WEBHOOK_SECRET;
  if (!secret) return true;

  const id = headers.get("webhook-id");
  const timestamp = headers.get("webhook-timestamp");
  const signatureHeader = headers.get("webhook-signature");
  if (!id || !timestamp || !signatureHeader) return false;

  // Reject stale replays — 5 minute tolerance, same window Svix recommends.
  const ts = Number(timestamp);
  if (!ts || Math.abs(Date.now() / 1000 - ts) > 300) return false;

  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const signedContent = `${id}.${timestamp}.${rawBody}`;
  const expected = crypto.createHmac("sha256", secretBytes).update(signedContent).digest("base64");

  const provided = signatureHeader.split(" ").map((s) => s.split(",")[1]).filter(Boolean);
  return provided.some((sig) => {
    try {
      return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    } catch {
      return false;
    }
  });
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    if (!verifySignature(rawBody, req.headers)) {
      console.error("Replicate webhook: signature verification failed");
      return NextResponse.json({ error: "invalid signature" }, { status: 401 });
    }

    const body = JSON.parse(rawBody);
    const { id: predictionId, status, output } = body;

    if (status !== "succeeded" || !output) return NextResponse.json({ ok: true });

    const outputUrl = Array.isArray(output) ? output[0] : output;

    // Check if this is a video
    const video = await prisma.generatedVideo.findFirst({
      where: { url: predictionId },
    });

    if (video) {
      let finalUrl = outputUrl;
      try {
        const res = await fetch(outputUrl);
        const buf = Buffer.from(await res.arrayBuffer());
        const key = getStorageKey(video.userId, "video", `${video.id}.mp4`);
        finalUrl = await uploadToStorage(buf, key, "video/mp4");
      } catch { /* use original */ }

      await prisma.generatedVideo.update({ where: { id: video.id }, data: { url: finalUrl } });
      return NextResponse.json({ ok: true });
    }

    // Check if this is music
    const music = await prisma.generatedMusic.findFirst({
      where: { url: predictionId },
    });

    if (music) {
      let finalUrl = outputUrl;
      try {
        const res = await fetch(outputUrl);
        const buf = Buffer.from(await res.arrayBuffer());
        const key = getStorageKey(music.userId, "music", `${music.id}.mp3`);
        finalUrl = await uploadToStorage(buf, key, "audio/mpeg");
      } catch { /* use original */ }

      await prisma.generatedMusic.update({ where: { id: music.id }, data: { url: finalUrl } });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json({ ok: true }); // Always 200 to prevent retries
  }
}
