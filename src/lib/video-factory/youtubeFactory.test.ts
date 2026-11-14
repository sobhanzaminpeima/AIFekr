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
