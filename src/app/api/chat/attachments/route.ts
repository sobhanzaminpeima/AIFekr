export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import {
  extractDocument,
  signDocument,
  MAX_DOCUMENT_BYTES,
} from "@/lib/chat/documents";
import { rateLimit } from "@/lib/utils/rateLimit";
export async function POST(req: NextRequest) {
  const u = await requireAuth(req);
  if (!u) return unauthorizedResponse(req);
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host"))
    return NextResponse.json({ error: "ORIGIN_FORBIDDEN" }, { status: 403 });
  if (!rateLimit(`chat-document:${u.id}`, 10, 60000).allowed)
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  try {
    if (
      Number(req.headers.get("content-length") || 0) >
      MAX_DOCUMENT_BYTES + 100000
    )
      throw Error("FILE_TOO_LARGE");
    const form = await req.formData(),
      file = form.get("file");
    if (!(file instanceof File)) throw Error("FILE_REQUIRED");
    if (file.size > MAX_DOCUMENT_BYTES) throw Error("FILE_TOO_LARGE");
    const text = await extractDocument(
      file.name,
      Buffer.from(await file.arrayBuffer()),
    );
    return NextResponse.json(
      { attachment: signDocument(u.id, file.name, text) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "EXTRACTION_FAILED" },
      { status: 400 },
    );
  }
}
