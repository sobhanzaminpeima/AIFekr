import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { prisma } from "@/lib/db/prisma";
import { embedTexts, hasEmbeddings } from "@/lib/rag/embeddings";
import { parseKbDocument, KB_LANGS, type ParsedBlock } from "./parse";
import { docSlugs } from "../registry";

/**
 * Syncs `docs/knowledge-base/*.md` into KbDocument/KbChunk.
 *
 * Two requirements from the master prompt shape this (§2.2): the doc-set must
 * be editable by the AIFekr team, and updating it must not mean re-embedding
 * everything each time.
 *
 *   - Editable: the source of truth is plain markdown in the repo, reviewable
 *     in a diff like any other change — not a blob inside a prompt string.
 *   - Cheap to update: every language block and every chunk carries a SHA-256
 *     of its own source. An unchanged block is skipped without reading a
 *     single chunk; within a changed block, a chunk whose text is byte-identical
 *     keeps the embedding it already had. Fixing one typo in one section costs
 *     one embedded text, not a full re-index.
 *
 * The work is done in two passes — decide everything first, then embed all the
 * new text in one batched call, then write. Embedding chunk-by-chunk inside
 * the write loop looked simpler but hit Cohere's requests-per-minute cap after
 * exactly 100 chunks and silently left the remaining 122 without vectors
 * (measured on the real doc-set, 2026-09-11). Batching turns 222 requests into
 * three.
 *
 * Files live at process.cwd() rather than being bundled, which works on this
 * server because deploys ship the whole tree, not a standalone bundle.
 */

const KB_DIR = path.join(process.cwd(), "docs", "knowledge-base");

/**
 * Bump this whenever the CHUNKING or EMBEDDING strategy changes — not when a
 * document's content changes.
 *
 * Block hashes are taken from the markdown source, so editing a doc correctly
 * invalidates only that doc. But a change to how text is split or what text
 * gets embedded leaves every source byte identical, and the next sync reports
 * "51 unchanged" while the stored vectors are all built the old way. That
 * happened once already (2026-09-11, when the document title was added to each
 * chunk's embedded text) and the stale index looked perfectly healthy. Mixing
 * this version into the hash makes such a change invalidate everything, which
 * is the correct blast radius for it.
 *
 * v2 — chunk text is prefixed with the document title.
 */
const CHUNKER_VERSION = "v2";

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/** Hash of a language block's source, bound to the chunking strategy that produced its rows. */
function blockFingerprint(raw: string): string {
  return sha256(`${CHUNKER_VERSION}::${raw}`);
}

export interface SyncDocReport {
  slug: string;
  lang: string;
  status: "created" | "updated" | "unchanged";
  chunks: number;
  embedded: number;
  reused: number;
  embedFailed: number;
}

export interface SyncReport {
  /** False when COHERE_API_KEY is absent — chunks are still stored, but retrieval degrades to keyword-only. */
  embeddingsAvailable: boolean;
  documents: SyncDocReport[];
  /** Files whose `slug` nothing in the registry points at — usually a typo or an orphaned doc. */
  unreferencedSlugs: string[];
  /** Registry doc slugs with no markdown file at all — the assistant will have nothing to say about these. */
  missingSlugs: string[];
  /** `<slug>: missing <langs>` for files that don't carry all three languages. */
  incompleteTranslations: string[];
  deletedDocuments: number;
  errors: string[];
}

/** A language block that changed and therefore has to be rewritten. */
interface PendingBlock {
  slug: string;
  capabilityKey: string | null;
  block: ParsedBlock;
  blockHash: string;
  existingId: string | null;
  /** chunk hash → stored embedding, carried over from the previous version of this block. */
  reusable: Map<string, string>;
  /** Per-chunk: its hash, and the index into the batch embedding request (or -1 if reused/not embedded). */
  chunkPlan: Array<{ hash: string; batchIndex: number }>;
}

async function planBlock(slug: string, capabilityKey: string | null, block: ParsedBlock, force: boolean): Promise<PendingBlock | SyncDocReport> {
  const blockHash = blockFingerprint(block.raw);
  const existing = await prisma.kbDocument.findUnique({
    where: { slug_lang: { slug, lang: block.lang } },
    include: { chunks: { select: { hash: true, embedding: true } } },
  });

  if (!force && existing && existing.hash === blockHash) {
    return { slug, lang: block.lang, status: "unchanged", chunks: existing.chunks.length, embedded: 0, reused: existing.chunks.length, embedFailed: 0 };
  }

  // Embeddings are keyed by chunk text, so a section that survived the edit
  // untouched keeps its vector even if sections around it moved or were
  // renumbered. Rebuilding the chunk rows wholesale (rather than diffing them
  // in place) keeps ordinals correct after an insertion without a fiddly
  // reconciliation pass; the embeddings — the only expensive part — carry over.
  // A forced rebuild re-embeds from scratch rather than carrying vectors over:
  // the reason to force is that the existing vectors are suspect, so reusing
  // them would defeat the point.
  const reusable = new Map<string, string>();
  if (!force) {
    for (const c of existing?.chunks ?? []) {
      if (c.embedding) reusable.set(c.hash, c.embedding);
    }
  }

  return {
    slug,
    capabilityKey,
    block,
    blockHash,
    existingId: existing?.id ?? null,
    reusable,
    chunkPlan: block.chunks.map((c) => ({ hash: sha256(c.text), batchIndex: -1 })),
  };
}

function isPending(x: PendingBlock | SyncDocReport): x is PendingBlock {
  return "block" in x;
}

async function writeBlock(pending: PendingBlock, vectors: (number[] | null)[]): Promise<SyncDocReport> {
  const { slug, capabilityKey, block, blockHash, existingId, reusable, chunkPlan } = pending;

  const doc = existingId
    ? await prisma.kbDocument.update({ where: { id: existingId }, data: { title: block.title, capabilityKey, hash: blockHash } })
    : await prisma.kbDocument.create({ data: { slug, lang: block.lang, title: block.title, capabilityKey, hash: blockHash } });

  if (existingId) await prisma.kbChunk.deleteMany({ where: { documentId: doc.id } });

  let embedded = 0;
  let reused = 0;
  let embedFailed = 0;

  for (let i = 0; i < block.chunks.length; i++) {
    const chunk = block.chunks[i];
    const { hash, batchIndex } = chunkPlan[i];
    let embedding = reusable.get(hash) ?? null;

    if (embedding) {
      reused += 1;
    } else if (batchIndex >= 0) {
      const vec = vectors[batchIndex];
      if (vec) {
        embedding = JSON.stringify(vec);
        embedded += 1;
      } else {
        // embedTexts never throws — a null means Cohere was unreachable or
        // rejected the request. Store the chunk anyway: keyword scoring in
        // search.ts still finds it, and the next sync fills the vector in.
        embedFailed += 1;
      }
    }

    await prisma.kbChunk.create({
      data: { documentId: doc.id, ordinal: chunk.ordinal, heading: chunk.heading, text: chunk.text, hash, embedding },
    });
  }

  return { slug, lang: block.lang, status: existingId ? "updated" : "created", chunks: block.chunks.length, embedded, reused, embedFailed };
}

/** `force` re-reads and re-embeds every document even when nothing changed — the operational escape hatch for a suspect index. */
export async function syncKnowledgeBase(force = false): Promise<SyncReport> {
  const report: SyncReport = {
    embeddingsAvailable: hasEmbeddings,
    documents: [],
    unreferencedSlugs: [],
    missingSlugs: [],
    incompleteTranslations: [],
    deletedDocuments: 0,
    errors: [],
  };

  if (!fs.existsSync(KB_DIR)) {
    report.errors.push(`Knowledge-base directory not found at ${KB_DIR}`);
    return report;
  }

  // README.md documents the format for whoever edits the doc-set; it is not
  // itself knowledge for the assistant.
  const files = fs.readdirSync(KB_DIR).filter((f) => f.endsWith(".md") && f.toLowerCase() !== "readme.md");
  const registrySlugs = new Set(docSlugs());
  const seenSlugs = new Set<string>();

  // ── Pass 1: decide what changed, and collect every text needing a vector ──
  const pending: PendingBlock[] = [];
  const toEmbed: string[] = [];

  for (const file of files) {
    const fileSlug = file.replace(/\.md$/, "");
    try {
      const parsed = parseKbDocument(fileSlug, fs.readFileSync(path.join(KB_DIR, file), "utf-8"));
      seenSlugs.add(parsed.slug);

      if (!registrySlugs.has(parsed.slug)) report.unreferencedSlugs.push(parsed.slug);
      if (parsed.missingLangs.length) {
        report.incompleteTranslations.push(`${parsed.slug}: missing ${parsed.missingLangs.join(", ")}`);
      }

      for (const block of parsed.blocks) {
        const planned = await planBlock(parsed.slug, parsed.capabilityKey, block, force);
        if (!isPending(planned)) {
          report.documents.push(planned);
          continue;
        }
        planned.chunkPlan.forEach((plan, i) => {
          if (planned.reusable.has(plan.hash)) return;
          plan.batchIndex = toEmbed.length;
          toEmbed.push(planned.block.chunks[i].text);
        });
        pending.push(planned);
      }
    } catch (err) {
      report.errors.push(`${file}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // ── Pass 2: one batched embedding request set for the whole sync ──
  const vectors = toEmbed.length ? await embedTexts(toEmbed, "search_document") : [];

  // ── Pass 3: write ──
  for (const p of pending) {
    try {
      report.documents.push(await writeBlock(p, vectors));
    } catch (err) {
      report.errors.push(`${p.slug} (${p.block.lang}): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  report.missingSlugs = Array.from(registrySlugs).filter((s) => !seenSlugs.has(s));

  // Drop rows for documents whose file was deleted or renamed, so the
  // assistant can never cite a page that no longer exists. Skipped entirely
  // when nothing parsed — an empty `notIn` matches every row, so a sync run
  // against an empty or unreadable directory would otherwise wipe the whole
  // knowledge base instead of reporting that it found nothing.
  if (seenSlugs.size > 0) {
    const stale = await prisma.kbDocument.findMany({
      where: { OR: [{ slug: { notIn: Array.from(seenSlugs) } }, { lang: { notIn: KB_LANGS } }] },
      select: { id: true },
    });
    if (stale.length) {
      await prisma.kbDocument.deleteMany({ where: { id: { in: stale.map((d) => d.id) } } });
      report.deletedDocuments = stale.length;
    }
  } else if (files.length > 0) {
    report.errors.push("No document parsed from any file — leaving existing knowledge base untouched.");
  }

  return report;
}
