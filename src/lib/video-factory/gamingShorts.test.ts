import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import Database from "better-sqlite3";
import JSZip from "jszip";
import sharp from "sharp";
import { NextRequest } from "next/server";
vi.hoisted(() => {
  process.env.DATABASE_URL = `file:${process.cwd().replace(/\\/g, "/")}/tmp/gaming-integration-${process.pid}.db`;
  process.env.VIDEO_FACTORY_STORAGE_DIR = `${process.cwd().replace(/\\/g, "/")}/tmp/gaming-storage-${process.pid}`;
});
vi.mock("./render", async original => ({
  ...await original<typeof import("./render")>(),
  mediaCommand: vi.fn(async () => JSON.stringify({ format: { duration: "30" }, streams: [
    { codec_type: "video", codec_name: "h264", width: 720, height: 1280 }, { codec_type: "audio", codec_name: "aac" },
  ] })),
}));
import { prisma } from "@/lib/db/prisma";
import { artifactDirectory } from "./render";
import { createGamingDraft, deliverGamingOrder, finishGamingUpload, gamingAdminAction,
  gamingCatalog, gamingDownload, gamingCustomerAction, GAMING_CHUNK, GAMING_PLAN, submitGamingOrder, uploadGamingChunk } from "./gamingShorts";

describe("Gaming Shorts isolated order", () => {
  let owner: string, other: string, id: string;
  const video = Buffer.concat([Buffer.from([0, 0, 0, 20]), Buffer.from("ftypisom"), Buffer.alloc(GAMING_CHUNK + 100)]);
  const upload = (offset: number, bytes: Buffer) => new NextRequest("http://localhost/api/video-factory/gaming", {
    method: "PUT", headers: { "x-upload-offset": String(offset) }, body: new Uint8Array(bytes),
  });
  beforeAll(async () => {
    mkdirSync("tmp", { recursive: true });
    const sql = execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "diff",
      "--from-empty", "--to-schema-datamodel", "prisma/schema.prisma", "--script"], { encoding: "utf8" });
    const db = new Database(process.env.DATABASE_URL!.slice(5));
    // Run the additive migration against the previous table set.
    db.exec(sql);
    db.exec('DROP TABLE "GamingShortsOrder"');
    db.exec(readFileSync("prisma/migrations/20261123090000_gaming_shorts/migration.sql", "utf8")); db.close();
    owner = (await prisma.user.create({ data: { email: `gaming-${randomUUID()}@test.invalid`, role: "ADMIN" } })).id;
    other = (await prisma.user.create({ data: { email: `other-${randomUUID()}@test.invalid` } })).id;
  }, 90000);
  afterAll(async () => { await prisma.$disconnect(); });
  it("persists one draft and rejects reuse with a changed file", async () => {
    const input = { requestKey: randomUUID(), sourceName: "sample.mp4", sourceBytes: video.length,
      sourceFingerprint: "a".repeat(64), channel: "@test", language: "fa", rightsConfirmed: true };
    const first = await createGamingDraft(owner, input); id = first.id;
    expect((await createGamingDraft(owner, input)).id).toBe(id);
    await expect(createGamingDraft(owner, { ...input, sourceFingerprint: "b".repeat(64) })).rejects.toThrow("IDEMPOTENCY_CONFLICT");
    await expect(createGamingDraft(other, { ...input, requestKey: randomUUID() })).rejects.toThrow("GAMING_SALES_NOT_OPEN");
  });
  it("recovers an unacknowledged chunk and uses server offsets", async () => {
    await expect(uploadGamingChunk(other, id, upload(0, video))).rejects.toThrow("ORDER_NOT_FOUND");
    expect((await uploadGamingChunk(owner, id, upload(0, video.subarray(0, GAMING_CHUNK)))).uploadedBytes).toBe(GAMING_CHUNK);
    await expect(uploadGamingChunk(owner, id, upload(0, video.subarray(0, GAMING_CHUNK)))).rejects.toThrow("UPLOAD_OFFSET_CHANGED");
    const row = await prisma.gamingShortsOrder.findUniqueOrThrow({ where: { id } });
    const file = path.join(artifactDirectory(row.sourceKey), "source.mp4");
    await writeFile(path.join(artifactDirectory(row.sourceKey), "chunk-" + GAMING_CHUNK), video.subarray(GAMING_CHUNK));
    await uploadGamingChunk(owner, id, upload(GAMING_CHUNK, video.subarray(GAMING_CHUNK)));
    expect((await finishGamingUpload(owner, id)).status).toBe("UPLOADED");
    expect((await stat(file)).size).toBe(video.length);
    expect((await readFile(file)).equals(video)).toBe(true);
  });
  it("consumes exactly one owned payment, with no wallet charge or duplicate notification", async () => {
    await expect(submitGamingOrder(owner, id)).rejects.toThrow("GAMING_PACKAGE_REQUIRED");
    await prisma.payment.create({ data: { userId: owner, amount: 0, plan: GAMING_PLAN, status: "SUCCESS", gateway: "local-test",
      entitlementSnapshot: JSON.stringify({ category: "VIDEO_FACTORY", days: 30, entitlements: { limits: { gamingShorts: 3 } } }) } });
    const before = (await prisma.user.findUniqueOrThrow({ where: { id: owner } })).credits;
    const a = await submitGamingOrder(owner, id), b = await submitGamingOrder(owner, id);
    expect(a.paymentId).toBe(b.paymentId);
    expect((await prisma.notification.count({ where: { type: "economy_gaming_new" } }))).toBe(1);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: owner } })).credits).toBe(before);
    const second = await createGamingDraft(owner, { requestKey: randomUUID(), sourceName: "second.mp4", sourceFingerprint: "c".repeat(64),
      sourceBytes: video.length, channel: "@test", language: "en", rightsConfirmed: true });
    await prisma.gamingShortsOrder.update({ where: { id: second.id }, data: { status: "UPLOADED", uploadedBytes: video.length } });
    await expect(submitGamingOrder(owner, second.id)).rejects.toThrow("GAMING_PACKAGE_REQUIRED");
    await gamingAdminAction(owner, { id, action: "APPROVE" });
    await gamingAdminAction(owner, { id, action: "APPROVE" });
    expect(await prisma.notification.count({ where: { type: "economy_gaming_approved" } })).toBe(1);
  });
  it("accepts a three-file delivery once, privately streams it, and notifies once", async () => {
    const zip = new JSZip();
    for (let i = 1; i <= 3; i++) {
      zip.file(`clip-${i}.mp4`, video);
      zip.file(`cover-${i}.png`, await sharp({ create: { width: 90, height: 160, channels: 3, background: "orange" } }).png().toBuffer());
      zip.file(`captions-${i}.srt`, "1\n00:00:00,000 --> 00:00:03,000\nTest\n");
    }
    zip.file("publishing.json", JSON.stringify([1, 2, 3].map(i => ({ title: "Test " + i, description: "Local test", tags: ["test"] }))));
    const bytes = await zip.generateAsync({ type: "nodebuffer" });
    const req = () => new NextRequest("http://localhost", { method: "POST", body: new Uint8Array(bytes) });
    expect((await deliverGamingOrder(owner, id, req())).status).toBe("DELIVERED");
    await expect(deliverGamingOrder(owner, id, req())).rejects.toThrow("ORDER_APPROVAL_REQUIRED");
    const get = new NextRequest("http://localhost?preview=1", { headers: { range: "bytes=0-11" } });
    await expect(gamingDownload(other, id, "clip-1.mp4", get)).rejects.toThrow("ORDER_NOT_FOUND");
    await expect(gamingDownload(owner, id, "../source.mp4", get)).rejects.toThrow("FILE_NOT_FOUND");
    const response = await gamingDownload(owner, id, "clip-1.mp4", get);
    expect(response.status).toBe(206); expect((await response.arrayBuffer()).byteLength).toBe(12);
    await gamingAdminAction(owner, { id, action: "NOTIFY" });
    await gamingAdminAction(owner, { id, action: "NOTIFY" });
    expect(await prisma.notification.count({ where: { type: "economy_gaming_ready" } })).toBe(1);
    expect((await gamingCatalog(owner)).orders[0]).not.toHaveProperty("sourceKey");
  });
  it("allows one owned revision, preserves payment and restarts delivery notification", async () => {
    const before = await prisma.gamingShortsOrder.findUniqueOrThrow({ where: { id } });
    await expect(gamingCustomerAction(other, id, { action: "REQUEST_REVISION", message: "Please correct the captions" })).rejects.toThrow("ORDER_NOT_FOUND");
    expect((await gamingCustomerAction(owner, id, { action: "REQUEST_REVISION", message: "Please correct the captions" })).status).toBe("REVISION_REQUESTED");
    await gamingCustomerAction(owner, id, { action: "REQUEST_REVISION", message: "Please correct the captions" });
    expect(await prisma.auditLog.count({ where: { targetId: id, action: "gaming_shorts.revision_requested" } })).toBe(1);
    await gamingAdminAction(owner, { id, action: "APPROVE" });
    await prisma.gamingShortsOrder.update({ where: { id }, data: { status: "DELIVERED", deliveredAt: new Date() } });
    await expect(gamingCustomerAction(owner, id, { action: "REQUEST_REVISION", message: "Another change request" })).rejects.toThrow("REVISION_ALREADY_USED");
    expect((await prisma.gamingShortsOrder.findUniqueOrThrow({ where: { id } })).paymentId).toBe(before.paymentId);
  });
  it("does not exceed global intake capacity", async () => {
    const input = { sourceName: "capacity.mp4", sourceFingerprint: "d".repeat(64), sourceBytes: video.length, channel: "@test", language: "en", rightsConfirmed: true };
    await prisma.gamingShortsOrder.updateMany({ where: { status: { in: ["DRAFT", "UPLOADED"] } }, data: { status: "DELIVERED" } });
    await createGamingDraft(owner, { ...input, requestKey: randomUUID() });
    await createGamingDraft(owner, { ...input, requestKey: randomUUID() });
    await expect(createGamingDraft(owner, { ...input, requestKey: randomUUID() })).rejects.toThrow("GAMING_CAPACITY_FULL");
  });
  it("records a cancellation once, blocks editing, and closes only with a resolution note", async () => {
    const row = await prisma.gamingShortsOrder.findFirstOrThrow({ where: { userId: owner, status: "DRAFT" } });
    await prisma.gamingShortsOrder.update({ where: { id: row.id }, data: { status: "PENDING" } });
    const action = { action: "REQUEST_CANCEL", message: "Please cancel before editing starts" };
    await gamingCustomerAction(owner, row.id, action);await gamingCustomerAction(owner, row.id, action);
    expect(await prisma.auditLog.count({ where: { targetId: row.id, action: "gaming_shorts.cancel_requested" } })).toBe(1);
    await expect(gamingAdminAction(owner, { id: row.id, action: "APPROVE" })).rejects.toThrow("ORDER_NOT_PAID");
    await expect(gamingAdminAction(owner, { id: row.id, action: "RESOLVE_CANCEL" })).rejects.toThrow("CANCELLATION_REVIEW_REQUIRED");
    expect((await gamingAdminAction(owner, { id: row.id, action: "RESOLVE_CANCEL", note: "Isolated test resolution; no bank transfer" })).status).toBe("CANCELLED");
  });
});
