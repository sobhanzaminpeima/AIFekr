export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { syncKnowledgeBase } from "@/lib/orchestrator/kb/ingest";
import { docSlugs } from "@/lib/orchestrator/registry";

/**
 * Re-indexes the support assistant's knowledge base from
 * `docs/knowledge-base/*.md`.
 *
 * This is the "update process" the master prompt asks for in §2.2, and it is
 * an admin route rather than a CLI script on purpose: this server runs the
 * app but has no ts-node/tsx, and the embedding helpers are TypeScript modules
 * under `src/lib`. Reaching them from a standalone script would mean either a
 * new build dependency or a duplicated copy of the Cohere call. Running inside
 * Next costs neither, works on the production box as it is, and turns
 * re-indexing into one authenticated request instead of a deploy.
 *
 * Only changed content is re-embedded — see ingest.ts. Running it twice in a
 * row is cheap and safe.
 */

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ?force=1 rebuilds and re-embeds everything even when no document changed.
  // Normal syncs are incremental; this is for when the index itself is
  // suspect — e.g. a previous run embedded only part of the corpus.
  const force = new URL(req.url).searchParams.get("force") === "1";
  const report = await syncKnowledgeBase(force);

  // Surfaced rather than buried in the JSON body: a sync that "succeeded" with
  // embeddings unavailable leaves the assistant on keyword-only retrieval,
  // which looks fine in a smoke test and is noticeably worse in real use.
  if (!report.embeddingsAvailable) {
    console.warn("[KB sync] COHERE_API_KEY missing or invalid — chunks stored without embeddings, retrieval is keyword-only.");
  }
  if (report.missingSlugs.length) {
    console.warn(`[KB sync] Registry references documents with no file: ${report.missingSlugs.join(", ")}`);
  }

  return NextResponse.json({ report });
}

/** Current index state, so an admin can see what the assistant actually knows without re-running a sync. */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const documents = await prisma.kbDocument.findMany({
    select: {
      slug: true,
      lang: true,
      title: true,
      capabilityKey: true,
      updatedAt: true,
      _count: { select: { chunks: true } },
    },
    orderBy: [{ slug: "asc" }, { lang: "asc" }],
  });

  const [totalChunks, embeddedChunks] = await Promise.all([
    prisma.kbChunk.count(),
    prisma.kbChunk.count({ where: { embedding: { not: null } } }),
  ]);

  const indexedSlugs = new Set(documents.map((d) => d.slug));

  return NextResponse.json({
    documents: documents.map((d) => ({ ...d, chunks: d._count.chunks, _count: undefined })),
    totalChunks,
    embeddedChunks,
    /** Chunks with no vector fall back to keyword scoring — a non-zero count here is a degraded index, not a broken one. */
    unembeddedChunks: totalChunks - embeddedChunks,
    missingSlugs: docSlugs().filter((s) => !indexedSlugs.has(s)),
  });
}
