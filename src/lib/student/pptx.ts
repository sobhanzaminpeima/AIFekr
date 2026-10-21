import JSZip from "jszip";

const MAX_SLIDES = 500;
const MAX_EXPANDED_SLIDE_BYTES = 20 * 1024 * 1024;

function decodeXmlText(value: string) {
  return value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (entity, name: string) => {
    const key = name.toLowerCase();
    if (key === "amp") return "&";
    if (key === "lt") return "<";
    if (key === "gt") return ">";
    if (key === "quot") return '"';
    if (key === "apos") return "'";
    const codePoint = key.startsWith("#x") ? Number.parseInt(key.slice(2), 16) : Number.parseInt(key.slice(1), 10);
    return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : entity;
  });
}

/** Extracts text-only slide content. It intentionally does not OCR images. */
export async function extractPptxText(buffer: Buffer, maxChars: number): Promise<string> {
  const zip = await JSZip.loadAsync(buffer, { checkCRC32: false, createFolders: false });
  const slides = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) => Number(a.match(/slide(\d+)/i)?.[1]) - Number(b.match(/slide(\d+)/i)?.[1]));
  if (slides.length > MAX_SLIDES) throw new Error("TOO_MANY_SLIDES");

  const parts: string[] = [];
  let expandedBytes = 0;
  let usedChars = 0;
  for (let index = 0; index < slides.length; index += 1) {
    const name = slides[index];
    const entry = zip.files[name];
    const declaredSize = (entry as typeof entry & { _data?: { uncompressedSize?: number } })._data?.uncompressedSize || 0;
    expandedBytes += declaredSize;
    if (expandedBytes > MAX_EXPANDED_SLIDE_BYTES) throw new Error("PPTX_EXPANDED_LIMIT");
    const xml = await entry.async("string");
    const text = Array.from(xml.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g))
      .map((match) => decodeXmlText(match[1])).join(" ").trim();
    if (!text || usedChars >= maxChars) continue;
    const part = `Slide ${index + 1}: ${text}`.slice(0, maxChars - usedChars);
    parts.push(part);
    usedChars += part.length + 1;
  }
  return parts.join("\n");
}
