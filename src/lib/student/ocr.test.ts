import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { extractPptxImages } from "./ocr";

describe("extractPptxImages", () => {
  it("extracts supported image media from a presentation", async () => {
    const zip = new JSZip();
    zip.file("ppt/media/image1.png", Buffer.from([137, 80, 78, 71]));
    zip.file("ppt/media/notes.txt", "not an image");
    zip.file("ppt/slides/slide1.xml", "<p:sld/>");
    const result = await extractPptxImages(await zip.generateAsync({ type: "nodebuffer" }));
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("image1.png");
    expect(result[0].mimeType).toBe("image/png");
    expect(result[0].data).toEqual(Buffer.from([137, 80, 78, 71]));
  });

  it("ignores unsupported media formats rather than treating them as images", async () => {
    const zip = new JSZip();
    zip.file("ppt/media/audio1.mp3", Buffer.from([1, 2, 3]));
    expect(await extractPptxImages(await zip.generateAsync({ type: "nodebuffer" }))).toEqual([]);
  });

  it("rejects presentations with more than the bounded image count", async () => {
    const zip = new JSZip();
    for (let index = 1; index <= 13; index += 1) zip.file(`ppt/media/image${index}.png`, Buffer.from([index]));
    await expect(extractPptxImages(await zip.generateAsync({ type: "nodebuffer" }))).rejects.toThrow("PPTX_IMAGE_COUNT");
  });
});
