import { afterEach, describe, expect, it, vi } from "vitest";
import { configurationSchema, manifestSchema, policySchema } from "./domain";
import { buildProductionPlan } from "./production";
import { generateImage } from "./mediaAdapters";
import type { RegisteredProvider } from "./registry";
import { channelContext, channelProfileSchema } from "./channelProfile";

afterEach(() => vi.unstubAllGlobals());
const base = { durationSeconds: 30, language: "fa", ratio: "16:9", mode: "AUTOPILOT", quality: "SMART", budgetCap: 1000, mediaMode: "MULTIMEDIA", shotsPerChapter: 2, imageEveryShot: true };
const policy = policySchema.parse({ enabled: true, creditsPerChapter: 1, creditsPerRenderMinute: 1, creditsPerImage: 1, creditsPerVoice: 1 });
const manifest = manifestSchema.parse({ characters: [{ name: "Stick", description: "A stickman" }], chapters: [{ title: "A", continuity: "", shots: [{ id: "c0-s0", title: "One", narration: "", visualPrompt: "Stickman at a desk" }] }] });
const imageTask = (extra: object) => buildProductionPlan(manifest, configurationSchema.parse({ ...base, ...extra }), policy).tasks.find((t) => t.kind === "IMAGE")!;

describe("YouTube factory: character, thumbnail and channel", () => {
  it("keeps existing image fingerprints unchanged until a character reference is chosen", () => {
    const plain = imageTask({}), withRef = imageTask({ characterReferenceAssetId: "ref-1" }), otherRef = imageTask({ characterReferenceAssetId: "ref-2" });
    expect(configurationSchema.parse(base)).toMatchObject({ characterReferenceAssetId: "", thumbnailAssetId: "" });
    expect(withRef.fingerprint).not.toBe(plain.fingerprint);
    expect(otherRef.fingerprint).not.toBe(withRef.fingerprint);
    expect(imageTask({ thumbnailAssetId: "thumb" }).fingerprint).toBe(plain.fingerprint);
  });

  it("sends the character image to Gemini with the shot prompt", async () => {
    const png = await (await import("sharp")).default({ create: { width: 2, height: 2, channels: 3, background: "#000" } }).png().toBuffer();
    const transport = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: png.toString("base64") } }] } }] }));
    vi.stubGlobal("fetch", transport);
    await generateImage({ id: "t", model: "m", key: "TEST-ONLY", adapter: "GEMINI_IMAGE" } as RegisteredProvider, "Stickman at a desk", "16:9", new AbortController().signal, [Buffer.from("REF")]);
    const parts = JSON.parse(transport.mock.calls[0][1]?.body as string).contents[0].parts;
    expect(parts[0].inlineData.data).toBe(Buffer.from("REF").toString("base64"));
    expect(parts[1].text).toContain("attached reference image");
    expect(parts[1].text).toContain("Stickman at a desk");
  });

  it("uses the image edit endpoint with the reference on OpenAI and plain generation without one", async () => {
    const transport = vi.fn<typeof fetch>().mockImplementation(async () => Response.json({ data: [{ b64_json: Buffer.from("IMG").toString("base64") }] }));
    vi.stubGlobal("fetch", transport);
    const provider = { id: "t", model: "gpt-image", key: "TEST-ONLY", adapter: "OPENAI_IMAGE" } as RegisteredProvider;
    await generateImage(provider, "p", "16:9", new AbortController().signal, [Buffer.from("REF")]);
    await generateImage(provider, "p", "16:9", new AbortController().signal);
    expect(String(transport.mock.calls[0][0])).toMatch(/\/images\/edits$/);
    expect((transport.mock.calls[0][1]?.body as FormData).getAll("image[]")).toHaveLength(1);
    expect(String(transport.mock.calls[1][0])).toMatch(/\/images\/generations$/);
  });

  it("validates channel details and passes only filled fields to the writer", () => {
    const profile = channelProfileSchema.parse({ handle: "@my_channel", niche: "Business stories" });
    expect(channelContext({ ...profile, saved: true })).toEqual({ handle: "@my_channel", niche: "Business stories", language: "fa" });
    expect(channelContext({ ...profile, saved: false })).toBeNull();
    expect(() => channelProfileSchema.parse({ handle: "bad handle!" })).toThrow();
    expect(() => channelProfileSchema.parse({ extra: 1 })).toThrow();
  });
});

import { PACKAGE_SHOTS_PER_CHAPTER, quote } from "./domain";
describe("image-motion package shot cap", () => {
  const pkg = policySchema.parse({ enabled: true, creditsPerChapter: 1, creditsPerRenderMinute: 1, creditsPerImage: 1, creditsPerVoice: 1, commercial: { pipeline: "IMAGE_MOTION" } });
  const config = (shotsPerChapter: number) => configurationSchema.parse({ ...base, quality: "SMART", shotsPerChapter });
  it("allows up to the approved 20 shots per chapter and refuses more", () => {
    expect(PACKAGE_SHOTS_PER_CHAPTER).toBe(20);
    expect(quote(config(20), pkg).items.find((i) => i.action === "images")?.quantity).toBe(20);
    expect(() => quote(config(21), pkg)).toThrow("PACKAGE_SHOT_LIMIT");
  });
});

import { FactoryError } from "./errors";
describe("budget cap error", () => {
  it("tells the client how many credits the cap must cover", () => {
    const policy = policySchema.parse({ enabled: true, creditsPerChapter: 1, creditsPerRenderMinute: 1, creditsPerImage: 100, creditsPerVoice: 1, commercial: { pipeline: "IMAGE_MOTION" } });
    const config = configurationSchema.parse({ ...base, quality: "SMART", shotsPerChapter: 20, budgetCap: 50 });
    try { quote(config, policy); throw new Error("expected BUDGET_EXCEEDED"); }
    catch (e) {
      expect(e).toBeInstanceOf(FactoryError);
      expect((e as FactoryError).code).toBe("BUDGET_EXCEEDED");
      expect((e as FactoryError).details?.budgetCap).toBe(50);
      expect((e as FactoryError).details?.required).toBeGreaterThan(50);
    }
  });
});

import { characterMode } from "./domain";
describe("fixed-character videos", () => {
  const manifest = { characters: [], chapters: [{ title: "c", continuity: "", shots: [{ id: "a", title: "t", narration: "", visualPrompt: "stickman", motion: "PUSH_IN" as const, notes: "", revision: 0, sfxPrompt: "" }] }] };
  const policy = (extra: Record<string, unknown>) => policySchema.parse({ enabled: true, creditsPerChapter: 1, creditsPerRenderMinute: 1, creditsPerImage: 1, creditsPerVoice: 1, providers: { image: "flux" }, commercial: { pipeline: "IMAGE_MOTION" }, ...extra });
  const cfg = (ref: string) => configurationSchema.parse({ ...base, quality: "SMART", characterReferenceAssetId: ref });
  it("stays off until the owner sets both the provider and the price", () => {
    expect(characterMode(cfg("ref1"), policy({}))).toBe(false);
    expect(characterMode(cfg("ref1"), policy({ characterImageProvider: "gemini" }))).toBe(false);
    expect(characterMode(cfg(""), policy({ characterImageProvider: "gemini", characterSaleCents: 1200 }))).toBe(false);
    expect(characterMode(cfg("ref1"), policy({ characterImageProvider: "gemini", characterSaleCents: 1200 }))).toBe(true);
  });
  it("routes images to the character provider only in character mode", () => {
    const on = policy({ characterImageProvider: "gemini", characterSaleCents: 1200 });
    const images = (c: ReturnType<typeof cfg>, p: ReturnType<typeof policy>) => buildProductionPlan(manifest as never, c, p).tasks.filter((t) => t.kind === "IMAGE").map((t) => t.providerId);
    expect(new Set(images(cfg("ref1"), on))).toEqual(new Set(["gemini"]));
    expect(new Set(images(cfg(""), on))).toEqual(new Set(["flux"]));
  });
});

describe("music availability", () => {
  it("refuses music at estimate time when no music provider is set", () => {
    const policy = policySchema.parse({ enabled: true, creditsPerChapter: 1, creditsPerRenderMinute: 1, creditsPerImage: 1, creditsPerVoice: 1, creditsPerMusicMinute: 1, providers: { image: "flux" }, commercial: { pipeline: "IMAGE_MOTION" } });
    const cfg = (music: boolean) => configurationSchema.parse({ ...base, quality: "SMART", mediaMode: "MULTIMEDIA", music });
    expect(() => quote(cfg(true), policy)).toThrow("MUSIC_UNAVAILABLE");
    expect(() => quote(cfg(false), policy)).not.toThrow();
  });
});

import { rerenderPrice } from "./rerenderPrice";
describe("re-render and music pricing", () => {
  const retail = (extra: Record<string, unknown>) => ({ ...policySchema.parse({ enabled: true, longFormEnabled: true, creditsPerChapter: 1, creditsPerRenderMinute: 1, creditsPerImage: 1, creditsPerVoice: 1, creditsPerMusicMinute: 1, providers: { image: "flux", music: "music" }, commercial: { pipeline: "IMAGE_MOTION", mode: "DURATION_RETAIL", status: "APPROVED", baseSeconds: 60, saleCents: 500 }, ...extra }), commercial: { ...policySchema.parse({}).commercial, pipeline: "IMAGE_MOTION" as const, mode: "DURATION_RETAIL" as const, status: "APPROVED" as const, baseSeconds: 60, saleCents: 500, creditRate: { planCode: "VF", usdCents: 100, credits: 100 } } });
  const cfg = (music = false) => configurationSchema.parse({ ...base, durationSeconds: 120, quality: "SMART", mediaMode: "MULTIMEDIA", music, budgetCap: 100000 });
  it("charges half the retail price when nothing must be generated again, full price when everything changed", () => {
    expect(rerenderPrice(1000, 0)).toBe(500);
    expect(rerenderPrice(1000, 0.1)).toBe(550);
    expect(rerenderPrice(1000, 1)).toBe(1000);
    const first = quote(cfg(), retail({})).credits;
    expect(quote(cfg(), retail({}), { rerenderShare: 0 }).credits).toBe(Math.ceil(first / 2));
    expect(quote(cfg(), retail({}), { rerenderShare: 1 }).credits).toBe(first);
  });
  it("adds music per started minute on top of retail, scaled for re-renders", () => {
    const withMusic = retail({ musicCreditsPerMinute: 180 });
    const plain = quote(cfg(false), withMusic).credits;
    expect(quote(cfg(true), withMusic).credits).toBe(plain + 360);
    expect(quote(cfg(true), withMusic, { rerenderShare: 0 }).items.find((i) => i.action === "music_addon")).toBeUndefined();
    expect(quote(cfg(true), retail({})).items.find((i) => i.action === "music_addon")).toBeUndefined();
  });
});
