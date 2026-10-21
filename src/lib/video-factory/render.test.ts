import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { artifactDirectory, artifactPath, dimensions, storyboardSvg } from "./render";
describe("private deterministic storyboard renderer", () => {
  it("rejects traversal and arbitrary deliverable paths", () => {
    expect(() => artifactDirectory("../../public")).toThrow("INVALID_JOB_ID");
    expect(() => artifactPath("test-job", "../../.env.local")).toThrow("ARTIFACT_NOT_FOUND");
    expect(artifactPath("test-job", "film.mp4")).toContain("test-job");
  });
  it("escapes user text as SVG data and keeps Persian text shaping enabled", async () => {
    const svg = storyboardSvg('عنوان فارسی <script>alert("x")</script>', 0, "9:16", true);
    expect(svg).not.toContain("<script>"); expect(svg).toContain("&lt;script&gt;"); expect(svg).toContain('direction="rtl"');
    const image = await sharp(Buffer.from(svg)).png().toBuffer();
    const info = await sharp(image).metadata(); expect(info.width).toBe(720); expect(info.height).toBe(1280);
    expect(dimensions("16:9")).toEqual([1280, 720]); expect(dimensions("1:1")).toEqual([720, 720]);
  });
});
