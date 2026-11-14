import { describe, expect, it } from "vitest";
import { inflateRawSync } from "node:zlib";
import { crc32, promptList, shotCode, shotForFilename, shotMedia, storedZip, withShotAsset } from "./media";
import type { Manifest } from "./domain";

const shot = (id: string, prompt: string, assetId?: string) => ({ id, title: id, narration: "n " + id, visualPrompt: prompt, motion: "PUSH_IN" as const, notes: "", revision: 0, sfxPrompt: "", ...(assetId ? { assetId } : {}) });
const manifest: Manifest = { characters: [], chapters: [{ title: "A", continuity: "", shots: [shot("a1", "Blockbuster store at night"), shot("a2", "Boardroom, $50M offer", "img-2")] }, { title: "B", continuity: "", shots: [shot("b1", "Streaming on a laptop")] }] };

describe("video factory media library", () => {
  it("numbers every shot across chapters", () => {
    const list = shotMedia(manifest);
    expect(list.map((s) => s.code)).toEqual(["SHOT_001", "SHOT_002", "SHOT_003"]);
    expect(list[1]).toMatchObject({ id: "a2", chapter: 1, assetId: "img-2" });
    expect(shotCode(70)).toBe("SHOT_070");
  });

  it("exports prompts as [SHOT n] blocks for bulk image tools", () => {
    const text = promptList(shotMedia(manifest), "Stickman documentary");
    expect(text).toContain("[SHOT 1]\nBlockbuster store at night\nStyle: Stickman documentary");
    expect(text).toContain("[SHOT 3]\nStreaming on a laptop");
  });

  it("matches dropped files to shots by their number", () => {
    const list = shotMedia(manifest);
    expect(["SHOT_002.png", "shot-2.jpg", "002.webp", "Shot 2 final.png"].map((n) => shotForFilename(n, list)?.id)).toEqual(["a2", "a2", "a2", "a2"]);
    expect(shotForFilename("cover.png", list)).toBeNull();
    expect(shotForFilename("SHOT_099.png", list)).toBeNull();
  });

  it("sets, replaces or clears one shot's image and leaves the rest", () => {
    const next = withShotAsset(manifest, "a1", "up-1");
    expect(shotMedia(next).map((s) => s.assetId)).toEqual(["up-1", "img-2", null]);
    const cleared = withShotAsset(next, "a2", null, true);
    expect(shotMedia(cleared)[1].assetId).toBeNull();
    expect(cleared.chapters[0].shots[1].revision).toBe(1);
    expect(() => withShotAsset(manifest, "nope", "x")).toThrow("SHOT_NOT_FOUND");
  });

  it("writes a valid ZIP whose entries read back byte for byte", () => {
    const files = [{ name: "SHOT_001.png", data: Buffer.from("first image") }, { name: "SHOT_002.jpg", data: Buffer.from("second") }];
    const zip = storedZip(files);
    expect(zip.readUInt32LE(0)).toBe(0x04034b50);
    expect(zip.readUInt32LE(zip.length - 22)).toBe(0x06054b50);
    expect(zip.readUInt16LE(zip.length - 12)).toBe(2);
    // First entry: header 30 + name, then the stored bytes.
    const nameLen = zip.readUInt16LE(26), size = zip.readUInt32LE(18);
    expect(zip.subarray(30, 30 + nameLen).toString()).toBe("SHOT_001.png");
    expect(zip.subarray(30 + nameLen, 30 + nameLen + size).toString()).toBe("first image");
    expect(zip.readUInt32LE(14)).toBe(crc32(Buffer.from("first image")));
    expect(typeof inflateRawSync).toBe("function");
  });
});

import { visualKinds } from "./production";
describe("one image for every shot", () => {
  it("makes every non-video shot an image instead of the preset's share", () => {
    const policy = { presets: { SMART: { imagePercent: 25, videoPercent: 0 } } } as never;
    expect(visualKinds(8, policy, "SMART").filter((k) => k === "IMAGE")).toHaveLength(2);
    expect(visualKinds(8, policy, "SMART", true).filter((k) => k === "IMAGE")).toHaveLength(8);
  });
});
