import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { extractPptxText } from "./pptx";

describe("extractPptxText", () => {
  it("extracts slide text in numeric order and decodes XML entities", async () => {
    const zip = new JSZip();
    zip.file("ppt/slides/slide2.xml", "<p:sld><a:t>Second &amp; final</a:t></p:sld>");
    zip.file("ppt/slides/slide10.xml", "<p:sld><a:t>Ten</a:t></p:sld>");
    zip.file("ppt/slides/slide1.xml", "<p:sld><a:t>First &#x26; foremost</a:t></p:sld>");
    const buffer = await zip.generateAsync({ type: "nodebuffer" });

    await expect(extractPptxText(buffer, 100)).resolves.toBe("Slide 1: First & foremost\nSlide 2: Second & final\nSlide 3: Ten");
  });

  it("bounds extracted text", async () => {
    const zip = new JSZip();
    zip.file("ppt/slides/slide1.xml", `<p:sld><a:t>${"x".repeat(200)}</a:t></p:sld>`);
    const buffer = await zip.generateAsync({ type: "nodebuffer" });

    await expect(extractPptxText(buffer, 32)).resolves.toHaveLength(32);
  });

  it("rejects malformed archives", async () => {
    await expect(extractPptxText(Buffer.from("not a zip"), 100)).rejects.toThrow();
  });
});
