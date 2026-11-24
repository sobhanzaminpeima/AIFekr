import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { link, mkdir, open, readFile, rm, stat, statfs, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import JSZip from "jszip";
import sharp from "sharp";
import { prisma } from "@/lib/db/prisma";
import { artifactDirectory, mediaCommand } from "./render";
import { FactoryError } from "./errors";

import { assertGamingCapacity, GAMING_PLAN, GAMING_MAX_BYTES } from "./gamingCapacity";
export { GAMING_PLAN, GAMING_MAX_BYTES } from "./gamingCapacity";
export const GAMING_CHUNK = 8 * 1024 * 1024;
export const GAMING_MAX_SECONDS = 1800;
const inputSchema = z.object({
  requestKey: z.string().uuid(), sourceName: z.string().trim().min(1).max(200),
  sourceFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  sourceBytes: z.number().int().min(12).max(GAMING_MAX_BYTES),
  channel: z.string().trim().min(1).max(500),
  language: z.enum(["fa", "en", "de", "tr"]), rightsConfirmed: z.literal(true),
}).strict();
const metadataSchema = z.array(z.object({
  title: z.string().trim().min(1).max(100),
  description: z.string().trim().min(1).max(5000),
  tags: z.array(z.string().trim().min(1).max(100)).max(30),
}).strict()).length(3);
function validateCaptions(srt: string, duration: number) {
  let previous = -1;
  for (const block of srt.trim().replace(/\r/g, "").split(/\n\s*\n/)) {
    const lines = block.split("\n");
    const times = /^(\d{2}):(\d{2}):(\d{2}),(\d{3}) --> (\d{2}):(\d{2}):(\d{2}),(\d{3})$/.exec(lines[1] || "");
    if (!/^\d+$/.test(lines[0]) || !times || !lines.slice(2).join("\n").trim()) throw new FactoryError("INVALID_CAPTIONS", 400);
    const values = times.slice(1).map(Number);
    const start = values[0] * 3600 + values[1] * 60 + values[2] + values[3] / 1000;
    const end = values[4] * 3600 + values[5] * 60 + values[6] + values[7] / 1000;
    if ([values[1], values[2], values[5], values[6]].some(n => n > 59) || start < previous || start >= end || end > duration + 0.25) {
      throw new FactoryError("INVALID_CAPTIONS", 400);
    }
    previous = start;
  }
}
const sourceFile = (key: string) => path.join(artifactDirectory(key), "source.mp4");
function view<T extends { sourceKey: string; uploadLease: string | null; uploadLeaseUntil: Date | null; deliveryKey: string | null }>(order: T) {
  const { sourceKey, uploadLease, uploadLeaseUntil, deliveryKey, ...safe } = order;
  return safe;
}
async function owned(userId: string, id: string) {
  const order = await prisma.gamingShortsOrder.findFirst({ where: { id, userId } });
  if (!order) throw new FactoryError("ORDER_NOT_FOUND", 404);
  return order;
}
export async function gamingCatalog(userId: string) {
  const orders = await prisma.gamingShortsOrder.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  const plan = await prisma.package.findUnique({ where: { planCode: GAMING_PLAN }, select: { isActive: true, publicationStatus: true, publicVisible: true } });
  const actor = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  const purchase = await prisma.payment.findFirst({ where: { userId, status: "SUCCESS", plan: GAMING_PLAN }, select: { id: true } });
  const used = orders.flatMap(o => o.paymentId ? [o.paymentId] : []);
  const unusedPurchases = await prisma.payment.count({ where: { userId, status: "SUCCESS", plan: GAMING_PLAN, id: { notIn: used } } });
  const pending = await prisma.payment.findMany({ where: { userId, plan: GAMING_PLAN, status: "PENDING" }, select: { id: true, entitlementSnapshot: true } });
  return { orders: orders.map(o => ({ ...view(o), pendingPaymentId: pending.find(p => { try { return JSON.parse(p.entitlementSnapshot).gamingOrderId === o.id; } catch { return false; } })?.id || null })), unusedPurchases, planCode: GAMING_PLAN,
    salesEnabled: !!plan?.isActive && plan.publicationStatus === "PUBLISHED" && plan.publicVisible,
    uploadAllowed: !!purchase || ["ADMIN", "SUPER_ADMIN"].includes(actor?.role || "") ||
      !!plan?.isActive && plan.publicationStatus === "PUBLISHED" && plan.publicVisible,
    maxBytes: GAMING_MAX_BYTES, maxSeconds: GAMING_MAX_SECONDS, chunkBytes: GAMING_CHUNK, outputCount: 3 };
}
export async function createGamingDraft(userId: string, raw: unknown) {
  const input = inputSchema.parse(raw);
  const storageRoot = path.dirname(artifactDirectory(randomUUID()));
  await mkdir(storageRoot, { recursive: true });
  const access = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  const plan = await prisma.package.findUnique({ where: { planCode: GAMING_PLAN } });
  const purchase = await prisma.payment.findFirst({ where: { userId, status: "SUCCESS", plan: GAMING_PLAN }, select: { id: true } });
  if (!["ADMIN", "SUPER_ADMIN"].includes(access?.role || "") &&
      !purchase && (!plan?.isActive || !plan.publicVisible || plan.publicationStatus !== "PUBLISHED")) {
    throw new FactoryError("GAMING_SALES_NOT_OPEN", 403);
  }
  return prisma.$transaction(async tx => {
    await tx.videoFactoryStorageQuota.upsert({ where: { userId }, create: { userId }, update: { usedBytes: { increment: 0 } } });
    const existing = await tx.gamingShortsOrder.findUnique({ where: { userId_requestKey: { userId, requestKey: input.requestKey } } });
    if (existing) {
      if (existing.sourceName !== input.sourceName || existing.sourceBytes !== input.sourceBytes || existing.sourceFingerprint !== input.sourceFingerprint || existing.channel !== input.channel || existing.language !== input.language) {
        throw new FactoryError("IDEMPOTENCY_CONFLICT", 409);
      }
      return view(existing);
    }
    await assertGamingCapacity(tx, userId);
    const drafts = await tx.gamingShortsOrder.findMany({ where: { userId, status: { in: ["DRAFT", "UPLOADED"] } }, select: { sourceBytes: true } });
    if (drafts.length >= 2 || drafts.reduce((n, o) => n + o.sourceBytes, 0) + input.sourceBytes > 4_000_000_000) {
      throw new FactoryError("UPLOAD_QUOTA_EXCEEDED", 413);
    }
    const reserved = await tx.gamingShortsOrder.aggregate({ where: { status: "DRAFT" },
      _sum: { sourceBytes: true, uploadedBytes: true } });
    const remaining = 2 * (reserved._sum.sourceBytes || 0) - (reserved._sum.uploadedBytes || 0);
    const disk = await statfs(storageRoot);
    if (disk.bavail * disk.bsize - remaining - 2 * input.sourceBytes < 1_000_000_000) throw new FactoryError("STORAGE_FULL", 503);
    return view(await tx.gamingShortsOrder.create({ data: { userId, requestKey: input.requestKey,
      sourceName: input.sourceName, sourceBytes: input.sourceBytes, sourceKey: randomUUID(),
      sourceFingerprint: input.sourceFingerprint,
      channel: input.channel, language: input.language, rightsConfirmedAt: new Date() } }));
  });
}
async function boundedBytes(req: NextRequest, max: number) {
  const reader = req.body?.getReader();
  if (!reader) throw new FactoryError("INVALID_INPUT", 400);
  const parts: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.byteLength;
    if (size > max) { await reader.cancel(); throw new FactoryError("INPUT_TOO_LARGE", 413); }
    parts.push(part.value);
  }
  if (!size) throw new FactoryError("INVALID_INPUT", 400);
  return Buffer.concat(parts);
}
/** Fixed-size immutable chunks survive lost acknowledgements without shared-file writes. */
export async function uploadGamingChunk(userId: string, id: string, req: NextRequest) {
  const offset = Number(req.headers.get("x-upload-offset"));
  if (!req.headers.has("x-upload-offset") || !Number.isSafeInteger(offset) || offset < 0) throw new FactoryError("INVALID_INPUT", 400);
  const order = await owned(userId, id);
  if (order.status !== "DRAFT") throw new FactoryError("UPLOAD_ALREADY_COMPLETE", 409);
  if (offset !== order.uploadedBytes || offset % GAMING_CHUNK !== 0) throw new FactoryError("UPLOAD_OFFSET_CHANGED", 409);
  const expected = Math.min(GAMING_CHUNK, order.sourceBytes - offset);
  const bytes = await boundedBytes(req, expected);
  if (bytes.length !== expected) throw new FactoryError("UPLOAD_CHUNK_INCOMPLETE", 400);
  const token = randomUUID();
  const claim = await prisma.gamingShortsOrder.updateMany({ where: { id, userId, status: "DRAFT", uploadedBytes: offset,
    OR: [{ uploadLease: null }, { uploadLeaseUntil: { lt: new Date() } }] },
    data: { uploadLease: token, uploadLeaseUntil: new Date(Date.now() + 120_000) } });
  if (!claim.count) throw new FactoryError("UPLOAD_BUSY", 409);
  const directory = artifactDirectory(order.sourceKey);
  const temporary = path.join(directory, token + ".part");
  try {
    await mkdir(directory, { recursive: true });
    const handle = await open(temporary, "wx");
    try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
    const chunk = path.join(directory, "chunk-" + offset);
    try { await link(temporary, chunk); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      // A previous process may have persisted this exact chunk before its DB
      // commit. Never overwrite a committed file, even after a lease expires.
      const existing = await readFile(chunk);
      if (!existing.equals(bytes)) throw new FactoryError("FILE_CHANGED", 409);
    }
    const saved = await prisma.gamingShortsOrder.updateMany({ where: { id, userId, uploadLease: token, uploadedBytes: offset },
      data: { uploadedBytes: offset + bytes.length, uploadLease: null, uploadLeaseUntil: null } });
    if (!saved.count) throw new FactoryError("UPLOAD_OFFSET_CHANGED", 409);
    return { uploadedBytes: offset + bytes.length };
  } finally {
    await rm(temporary, { force: true });
    await prisma.gamingShortsOrder.updateMany({ where: { id, uploadLease: token }, data: { uploadLease: null, uploadLeaseUntil: null } });
  }
}
export async function finishGamingUpload(userId: string, id: string) {
  const order = await owned(userId, id);
  if (order.status !== "DRAFT") return view(order);
  if (order.uploadedBytes !== order.sourceBytes) throw new FactoryError("UPLOAD_INCOMPLETE", 409);
  const token = randomUUID();
  const claim = await prisma.gamingShortsOrder.updateMany({ where: { id, userId, status: "DRAFT", uploadedBytes: order.sourceBytes,
    OR: [{ uploadLease: null }, { uploadLeaseUntil: { lt: new Date() } }] },
    data: { uploadLease: token, uploadLeaseUntil: new Date(Date.now() + 300_000) } });
  if (!claim.count) throw new FactoryError("UPLOAD_BUSY", 409);
  const directory = artifactDirectory(order.sourceKey);
  const file = path.join(directory, token + ".assembling.mp4");
  try {
    const disk = await statfs(directory);
    if (disk.bavail * disk.bsize < order.sourceBytes + 500_000_000) throw new FactoryError("STORAGE_FULL", 503);
    const output = await open(file, "wx");
    try {
      for (let offset = 0; offset < order.sourceBytes; offset += GAMING_CHUNK) {
        const bytes = await readFile(path.join(directory, "chunk-" + offset));
        if (bytes.length !== Math.min(GAMING_CHUNK, order.sourceBytes - offset)) throw new FactoryError("UPLOAD_INCOMPLETE", 409);
        await output.writeFile(bytes);
      }
      await output.sync();
    } finally { await output.close(); }
    const header = await open(file, "r");
    try {
      const bytes = Buffer.alloc(12);
      await header.read(bytes, 0, 12, 0);
      if (bytes.toString("ascii", 4, 8) !== "ftyp") throw new FactoryError("INVALID_VIDEO", 400);
    } finally { await header.close(); }
    const probe = JSON.parse(await mediaCommand("ffprobe", ["-v", "error", "-protocol_whitelist", "file",
      "-show_entries", "format=duration:stream=codec_type,width,height", "-of", "json", file]));
    const duration = Number(probe.format?.duration);
    if (!Number.isFinite(duration) || duration <= 0 || duration > GAMING_MAX_SECONDS || !probe.streams?.some((s: { codec_type: string }) => s.codec_type === "video")) {
      throw new FactoryError("SOURCE_LIMIT_EXCEEDED", 400);
    }
    if (!probe.streams.some((s: { codec_type: string; width?: number; height?: number }) =>
      s.codec_type === "video" && Math.min(s.width || 0, s.height || 0) >= 720)) {
      throw new FactoryError("SOURCE_RESOLUTION_TOO_LOW", 400);
    }
    const hash = createHash("sha256");
    for await (const chunk of createReadStream(file)) hash.update(chunk);
    const digest = hash.digest("hex");
    try { await link(file, sourceFile(order.sourceKey)); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const previous = createHash("sha256");
      for await (const chunk of createReadStream(sourceFile(order.sourceKey))) previous.update(chunk);
      if (previous.digest("hex") !== digest) throw new FactoryError("FILE_CHANGED", 409);
    }
    const completed = await prisma.gamingShortsOrder.updateMany({ where: { id, userId, status: "DRAFT", uploadedBytes: order.sourceBytes, uploadLease: token },
      data: { status: "UPLOADED", sourceSeconds: duration, sourceSha256: digest, uploadLease: null, uploadLeaseUntil: null } });
    if (!completed.count) throw new FactoryError("UPLOAD_BUSY", 409);
    for (let offset = 0; offset < order.sourceBytes; offset += GAMING_CHUNK) await rm(path.join(directory, "chunk-" + offset), { force: true });
    return view(await owned(userId, id));
  } finally {
    await rm(file, { force: true });
    await prisma.gamingShortsOrder.updateMany({ where: { id, uploadLease: token }, data: { uploadLease: null, uploadLeaseUntil: null } });
  }
}
export async function deleteGamingDraft(userId: string, id: string) {
  const order = await owned(userId, id);
  if (!["DRAFT", "UPLOADED"].includes(order.status)) throw new FactoryError("ORDER_IN_USE", 409);
  const removed = await prisma.$transaction(async tx => {
    await tx.siteSetting.upsert({ where: { key: "gamingIntakeLock" }, create: { key: "gamingIntakeLock", value: "1" }, update: { value: "1" } });
    const payments = await tx.payment.findMany({ where: { userId, plan: GAMING_PLAN, status: { in: ["PENDING", "SUCCESS"] } }, select: { entitlementSnapshot: true } });
    if (payments.some(p => { try { return JSON.parse(p.entitlementSnapshot).gamingOrderId === id; } catch { return false; } })) throw new FactoryError("ORDER_PAYMENT_PENDING", 409);
    return tx.gamingShortsOrder.deleteMany({ where: { id, userId, status: { in: ["DRAFT", "UPLOADED"] }, paymentId: null,
      OR: [{ uploadLease: null }, { uploadLeaseUntil: { lt: new Date() } }] } });
  });
  if (!removed.count) throw new FactoryError("ORDER_IN_USE", 409);
  await rm(artifactDirectory(order.sourceKey), { recursive: true, force: true });
  return { deleted: true };
}
export async function submitGamingOrder(userId: string, id: string) {
  return prisma.$transaction(async tx => {
    await tx.videoFactoryStorageQuota.upsert({ where: { userId }, create: { userId }, update: { usedBytes: { increment: 0 } } });
    const order = await tx.gamingShortsOrder.findFirst({ where: { id, userId } });
    if (!order) throw new FactoryError("ORDER_NOT_FOUND", 404);
    if (order.paymentId) return view(order);
    if (order.status !== "UPLOADED") throw new FactoryError("UPLOAD_INCOMPLETE", 409);
    const used = await tx.gamingShortsOrder.findMany({ where: { userId, paymentId: { not: null } }, select: { paymentId: true } });
    const payments = await tx.payment.findMany({ where: { userId, status: "SUCCESS", plan: GAMING_PLAN,
      id: { notIn: used.flatMap(p => p.paymentId ? [p.paymentId] : []) } }, orderBy: { createdAt: "asc" } });
    const payment = payments.find(p => {
      try {
        const snapshot = JSON.parse(p.entitlementSnapshot);
        return snapshot.category === "VIDEO_FACTORY" && snapshot.entitlements?.limits?.gamingShorts === 3 &&
          Number.isInteger(snapshot.days) && (p.reviewAt || p.createdAt).getTime() + snapshot.days * 86400000 > Date.now();
      } catch { return false; }
    });
    if (!payment) throw new FactoryError("GAMING_PACKAGE_REQUIRED", 402);
    const saved = await tx.gamingShortsOrder.update({ where: { id }, data: { paymentId: payment.id, status: "PENDING" } });
    const admins = await tx.user.findMany({ where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, isBlocked: false }, select: { id: true } });
    await tx.notification.createMany({ data: admins.map(a => ({ userId: a.id, type: "economy_gaming_new", title: "سفارش جدید Gaming Shorts",
      body: "یک فایل برای ساخت سه شورت ثبت شده است.", link: "/admin/users/requests?type=gaming", emailPending: true })) });
    return view(saved);
  });
}
export async function gamingAdminOrders() {
  const orders = await prisma.gamingShortsOrder.findMany({ where: { status: { in: ["PENDING", "APPROVED", "DELIVERED", "REVISION_REQUESTED", "CANCEL_REQUESTED"] } }, orderBy: { createdAt: "desc" }, take: 100 });
  return Promise.all(orders.map(async order => ({ ...view(order), requests: await prisma.auditLog.findMany({ where: { targetId: order.id, action: { in: ["gaming_shorts.revision_requested", "gaming_shorts.cancel_requested"] } }, select: { action: true, metadata: true, createdAt: true }, orderBy: { createdAt: "desc" } }) })));
}
export async function gamingAdminAction(actorId: string, raw: unknown) {
    const { id, action, note } = z.object({ id: z.string().uuid(), action: z.enum(["APPROVE", "NOTIFY", "RESOLVE_CANCEL", "RESUME"]), note: z.string().trim().min(10).max(2000).optional() }).strict().parse(raw);
  return prisma.$transaction(async tx => {
    const order = await tx.gamingShortsOrder.findUnique({ where: { id } });
    if (!order) throw new FactoryError("ORDER_NOT_FOUND", 404);
    if (action === "RESOLVE_CANCEL" || action === "RESUME") {
      if (!note || order.status !== "CANCEL_REQUESTED") throw new FactoryError("CANCELLATION_REVIEW_REQUIRED", 409);
      const resolved = await tx.gamingShortsOrder.updateMany({ where: { id, status: "CANCEL_REQUESTED" }, data: { status: action === "RESOLVE_CANCEL" ? "CANCELLED" : "PENDING" } });
      if (!resolved.count) throw new FactoryError("ORDER_CHANGED", 409);
      await tx.auditLog.create({ data: { actorId, targetId: id, action: "gaming_shorts." + action.toLowerCase(), metadata: JSON.stringify({ note, paymentId: order.paymentId, automaticRefund: false }) } });
      await tx.notification.create({ data: { userId: order.userId, type: "economy_gaming_cancel_resolution", title: action === "RESOLVE_CANCEL" ? "نتیجهٔ بررسی لغو سفارش" : "سفارش برای ادامه باز شد", body: note, link: "/video-factory?service=gaming", emailPending: true } });
      return view(await tx.gamingShortsOrder.findUniqueOrThrow({ where: { id } }));
    }
    const approve = action === "APPROVE";
    if (approve && !["PENDING", "APPROVED", "DELIVERED", "REVISION_REQUESTED"].includes(order.status)) throw new FactoryError("ORDER_NOT_PAID", 409);
    if (!approve && order.status !== "DELIVERED") throw new FactoryError("ORDER_NOT_DELIVERED", 409);
    const changed = await tx.gamingShortsOrder.updateMany({ where: approve ? { id, status: { in: ["PENDING", "REVISION_REQUESTED"] } } : { id, status: "DELIVERED", notifiedAt: null },
      data: approve ? { status: "APPROVED", approvedAt: new Date() } : { notifiedAt: new Date() } });
    if (changed.count) {
      await tx.notification.create({ data: { userId: order.userId, type: approve ? "economy_gaming_approved" : "economy_gaming_ready",
        title: approve ? "سفارش شورت شما تأیید شد" : "سه شورت شما آماده است",
        body: "وضعیت و فایل‌ها را در بخش Gaming Shorts مشاهده کنید.", link: "/video-factory?service=gaming", emailPending: true } });
      await tx.auditLog.create({ data: { actorId, targetId: id, action: "gaming_shorts." + action.toLowerCase() } });
    }
    return view(await tx.gamingShortsOrder.findUniqueOrThrow({ where: { id } }));
  });
}
export async function deliverGamingOrder(actorId: string, id: string, req: NextRequest) {
  const order = await prisma.gamingShortsOrder.findUnique({ where: { id } });
  if (!order || order.status !== "APPROVED") throw new FactoryError("ORDER_APPROVAL_REQUIRED", 409);
  const bytes = await boundedBytes(req, 150 * 1024 * 1024);
  let zip: JSZip;
  try { zip = await JSZip.loadAsync(bytes); } catch { throw new FactoryError("INVALID_DELIVERY", 400); }
  const allowed = ["publishing.json", ...[1, 2, 3].flatMap(n => [`clip-${n}.mp4`, `cover-${n}.png`, `captions-${n}.srt`])];
  if (Object.values(zip.files).some(f => f.dir || !allowed.includes(f.name)) || allowed.some(name => !zip.file(name))) throw new FactoryError("INVALID_DELIVERY", 400);
  // Read the central-directory sizes before extraction to bound compressed archives.
  const entries = Object.values(zip.files) as (JSZip.JSZipObject & { unsafeOriginalName?: string; _data?: { uncompressedSize?: number } })[];
  if (entries.some(f => (f.unsafeOriginalName && f.unsafeOriginalName !== f.name) || !Number.isSafeInteger(f._data?.uncompressedSize) || f._data!.uncompressedSize! > 50 * 1024 * 1024) ||
      entries.reduce((n, f) => n + f._data!.uncompressedSize!, 0) > 150 * 1024 * 1024) throw new FactoryError("INPUT_TOO_LARGE", 413);
  async function entryBytes(name: string, limit: number) {
    const stream = zip.file(name)!.nodeStream("nodebuffer") as Readable;
    let size = 0;
    const chunks: Buffer[] = [];
    return new Promise<Buffer>((resolve, reject) => {
      stream.on("data", (chunk: Buffer) => {
        size += chunk.byteLength;
        if (size > limit) {
          stream.pause();
          stream.destroy();
          reject(new FactoryError("INPUT_TOO_LARGE", 413));
          return;
        }
        chunks.push(chunk);
      });
      stream.on("error", reject);
      stream.on("end", () => resolve(Buffer.concat(chunks)));
    });
  }
  const metadata = metadataSchema.parse(JSON.parse((await entryBytes("publishing.json", 100_000)).toString("utf8")));
  const key = randomUUID(), directory = artifactDirectory(key);
  await mkdir(directory, { recursive: true });
  const disk = await statfs(directory);
  if (disk.bavail * disk.bsize < 850 * 1024 * 1024) {
    await rm(directory, { recursive: true, force: true });
    throw new FactoryError("STORAGE_FULL", 503);
  }
  try {
    const normalized = new JSZip();
    normalized.file("publishing.json", JSON.stringify(metadata, null, 2));
    for (let n = 1; n <= 3; n++) {
      const video = await entryBytes(`clip-${n}.mp4`, 50 * 1024 * 1024);
      if (video.toString("ascii", 4, 8) !== "ftyp") throw new FactoryError("INVALID_VIDEO", 400);
      const file = path.join(directory, `clip-${n}.mp4`);
      await writeFile(file, video);
      const probe = JSON.parse(await mediaCommand("ffprobe", ["-v", "error", "-protocol_whitelist", "file",
        "-show_entries", "format=duration:stream=codec_type,codec_name,width,height", "-of", "json", file]));
      const duration = Number(probe.format?.duration);
      if (!Number.isFinite(duration) || duration < 30 || duration > 60 || !probe.streams.some((s: { codec_type: string; codec_name: string }) => s.codec_type === "audio" && s.codec_name === "aac") ||
          !probe.streams.some((s: { codec_type: string; codec_name: string; width: number; height: number }) => s.codec_type === "video" && s.codec_name === "h264" && s.width >= 720 && s.width * 16 === s.height * 9)) {
        throw new FactoryError("INVALID_VIDEO", 400);
      }
      await mediaCommand("ffmpeg", ["-v", "error", "-protocol_whitelist", "file", "-i", file, "-f", "null", "-"], AbortSignal.timeout(30000));
      const png = await sharp(await entryBytes(`cover-${n}.png`, 8 * 1024 * 1024), { limitInputPixels: 8_000_000 }).png().toBuffer();
      await writeFile(path.join(directory, `cover-${n}.png`), png);
      const srt = (await entryBytes(`captions-${n}.srt`, 500_000)).toString("utf8");
      validateCaptions(srt, duration);
      await writeFile(path.join(directory, `captions-${n}.srt`), srt);
      normalized.file(`clip-${n}.mp4`, video);
      normalized.file(`cover-${n}.png`, png);
      normalized.file(`captions-${n}.srt`, srt);
    }
    await writeFile(path.join(directory, "delivery.zip"), await normalized.generateAsync({ type: "nodebuffer", compression: "STORE" }));
    return await prisma.$transaction(async tx => {
      const changed = await tx.gamingShortsOrder.updateMany({ where: { id, status: "APPROVED" }, data: {
        status: "DELIVERED", deliveryKey: key, delivery: JSON.stringify(metadata), deliveredAt: new Date(), notifiedAt: null } });
      if (!changed.count) throw new FactoryError("ORDER_ALREADY_DELIVERED", 409);
      await tx.auditLog.create({ data: { actorId, targetId: id, action: "gaming_shorts.delivered" } });
      return view(await tx.gamingShortsOrder.findUniqueOrThrow({ where: { id } }));
    });
  } catch (error) { await rm(directory, { recursive: true, force: true }); throw error; }
}
export async function gamingCustomerAction(userId: string, id: string, raw: unknown) {
  const { action, message } = z.object({ action: z.enum(["REQUEST_REVISION", "REQUEST_CANCEL"]), message: z.string().trim().min(10).max(2000) }).strict().parse(raw);
  return prisma.$transaction(async tx => {
    const order = await tx.gamingShortsOrder.findFirst({ where: { id, userId } });
    if (!order) throw new FactoryError("ORDER_NOT_FOUND", 404);
    const revision = action === "REQUEST_REVISION";
    const target = revision ? "REVISION_REQUESTED" : "CANCEL_REQUESTED";
    if (order.status === target) return view(order);
    if (revision) {
      if (order.status !== "DELIVERED") throw new FactoryError("ORDER_NOT_DELIVERED", 409);
      if (!order.deliveredAt || Date.now() - order.deliveredAt.getTime() > 7 * 86400000) throw new FactoryError("REVISION_WINDOW_CLOSED", 409);
      if (await tx.auditLog.count({ where: { targetId: id, action: "gaming_shorts.revision_requested" } })) throw new FactoryError("REVISION_ALREADY_USED", 409);
    } else if (order.status !== "PENDING") throw new FactoryError("CANCELLATION_REQUIRES_SUPPORT", 409);
    const changed = await tx.gamingShortsOrder.updateMany({ where: { id, userId, status: order.status }, data: { status: target } });
    if (!changed.count) throw new FactoryError("ORDER_CHANGED", 409);
    await tx.auditLog.create({ data: { actorId: userId, targetId: id, action: revision ? "gaming_shorts.revision_requested" : "gaming_shorts.cancel_requested", metadata: JSON.stringify({ message }) } });
    const admins = await tx.user.findMany({ where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, isBlocked: false }, select: { id: true } });
    await tx.notification.createMany({ data: admins.map(a => ({ userId: a.id, type: "economy_gaming_action", title: revision ? "درخواست اصلاح شورت" : "درخواست لغو سفارش شورت", body: message, link: "/admin/users/requests?type=gaming", emailPending: true })) });
    return view(await tx.gamingShortsOrder.findUniqueOrThrow({ where: { id } }));
  });
}
export async function gamingDownload(userId: string, id: string, name: string, req: NextRequest, admin = false) {
  const order = admin ? await prisma.gamingShortsOrder.findUnique({ where: { id } }) : await owned(userId, id);
  if (!order) throw new FactoryError("ORDER_NOT_FOUND", 404);
  let file: string, mime: string;
  if (admin && name === "source.mp4") { file = sourceFile(order.sourceKey); mime = "video/mp4"; }
  else {
    if (order.status !== "DELIVERED" || !order.deliveryKey ||
        !/^(delivery\.zip|(clip-[123]\.mp4)|(cover-[123]\.png)|(captions-[123]\.srt))$/.test(name)) throw new FactoryError("FILE_NOT_FOUND", 404);
    file = path.join(artifactDirectory(order.deliveryKey), name);
    mime = name.endsWith(".mp4") ? "video/mp4" : name.endsWith(".png") ? "image/png" : name.endsWith(".srt") ? "application/x-subrip" : "application/zip";
  }
  const size = (await stat(file)).size;
  const headers: Record<string, string> = { "Content-Type": mime, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    "Accept-Ranges": "bytes", "Content-Disposition": (req.nextUrl.searchParams.get("preview") === "1" ? "inline" : "attachment") + `; filename="${name}"` };
  let start = 0, end = size - 1;
  const range = req.headers.get("range");
  if (range) {
    const m = /^bytes=(\d+)-(\d*)$/.exec(range);
    if (!m || !Number.isSafeInteger(Number(m[1])) || Number(m[1]) >= size || (m[2] && Number(m[2]) < Number(m[1]))) {
      return new NextResponse(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${size}` } });
    }
    start = Number(m[1]); end = m[2] ? Math.min(Number(m[2]), end) : end;
    headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
  }
  headers["Content-Length"] = String(end - start + 1);
  return new NextResponse(Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream<Uint8Array>, { status: range ? 206 : 200, headers });
}
