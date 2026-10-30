import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

const auth = vi.hoisted(() => ({ user: null as null | { id: string } }));
vi.mock("@/lib/auth/middleware", () => ({
  requireAuth: async () => auth.user,
  unauthorizedResponse: () => NextResponse.json({ error: "unauthorized" }, { status: 401 }),
}));
import { DELETE } from "./route";

const owner = `gallery-owner-${Date.now()}`, other = owner + "-other";
let image = "", video = "", music = "";
const call = (id: string, type?: string) => DELETE(new NextRequest(`https://aifekr.com/api/gallery/${id}${type ? `?type=${type}` : ""}`, { method: "DELETE" }), { params: Promise.resolve({ id }) });

beforeAll(async () => {
  await prisma.user.createMany({ data: [{ id: owner }, { id: other }] });
  image = (await prisma.generatedImage.create({ data: { userId: owner, prompt: "p", url: "/i.png" } })).id;
  video = (await prisma.generatedVideo.create({ data: { userId: owner, prompt: "p", url: "/v.mp4" } })).id;
  music = (await prisma.generatedMusic.create({ data: { userId: owner, prompt: "p", url: "/m.mp3" } })).id;
});
afterAll(async () => {
  await prisma.generatedImage.deleteMany({ where: { userId: owner } });
  await prisma.generatedVideo.deleteMany({ where: { userId: owner } });
  await prisma.generatedMusic.deleteMany({ where: { userId: owner } });
  await prisma.user.deleteMany({ where: { id: { in: [owner, other] } } });
});

it("requires a signed-in account", async () => {
  auth.user = null;
  expect((await call(image)).status).toBe(401);
});
it("never deletes another account's creation", async () => {
  auth.user = { id: other };
  expect((await call(image)).status).toBe(404);
  expect(await prisma.generatedImage.count({ where: { id: image } })).toBe(1);
});
it("deletes the owner's image, video and music, with or without a type", async () => {
  auth.user = { id: owner };
  expect((await call(image)).status).toBe(200);
  expect((await call(video, "music")).status).toBe(404);
  expect((await call(video, "video")).status).toBe(200);
  expect((await call(music)).status).toBe(200);
  expect(await prisma.generatedImage.count({ where: { id: image } }) + await prisma.generatedVideo.count({ where: { id: video } }) + await prisma.generatedMusic.count({ where: { id: music } })).toBe(0);
});
