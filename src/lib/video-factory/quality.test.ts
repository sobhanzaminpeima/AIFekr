import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/lib/db/prisma", () => ({ prisma: { videoFactoryQualityReport: { create: vi.fn(async () => ({})) } } }));
vi.mock("./render", () => ({ artifactDirectory: () => "/test", mediaCommand: vi.fn() }));
import { mediaCommand } from "./render";
import { inspectRenderedShot } from "./quality";
import { configurationSchema, manifestSchema } from "./domain";
const configuration = configurationSchema.parse({ durationSeconds: 15, language: "en", ratio: "16:9", mode: "AUTOPILOT", quality: "SMART", budgetCap: 100, mediaMode: "MULTIMEDIA", narration: true });
const manifest = manifestSchema.parse({chapters:[{title:"Test",continuity:"Test",shots:[{id:"shot",title:"Test",narration:"Hello",visualPrompt:"Test"}]}]});
beforeEach(() => vi.mocked(mediaCommand).mockReset());
it("rejects a rendered scene with no audio stream even when volume metadata is present", async () => {
 vi.mocked(mediaCommand).mockResolvedValueOnce(JSON.stringify({format:{duration:15},streams:[{codec_type:"video"}]})).mockResolvedValueOnce("max_volume: -12 dB");
 await expect(inspectRenderedShot("test",0,manifest,configuration,AbortSignal.timeout(1000))).rejects.toThrow("SHOT_QUALITY_FAILED");
});
it("rejects an unreadable audio volume instead of passing narrated content", async () => {
 vi.mocked(mediaCommand).mockResolvedValueOnce(JSON.stringify({format:{duration:15},streams:[{codec_type:"video"},{codec_type:"audio"}]})).mockResolvedValueOnce("");
 await expect(inspectRenderedShot("test",0,manifest,configuration,AbortSignal.timeout(1000))).rejects.toThrow("SHOT_QUALITY_FAILED");
});
it("accepts a complete audible scene at the expected duration", async () => {
 vi.mocked(mediaCommand).mockResolvedValueOnce(JSON.stringify({format:{duration:15},streams:[{codec_type:"video"},{codec_type:"audio"}]})).mockResolvedValueOnce("max_volume: -12 dB");
 await expect(inspectRenderedShot("test",0,manifest,configuration,AbortSignal.timeout(1000))).resolves.toMatchObject({status:"PASSED"});
});

