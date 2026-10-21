import JSZip from "jszip";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024,
  MAX_DOCUMENT_TEXT = 16000;
export type DocumentAttachment = {
  name: string;
  text: string;
  expires: number;
  nonce: string;
  signature: string;
};
function secret() {
  if (!process.env.JWT_SECRET) throw Error("SIGNING_UNAVAILABLE");
  return process.env.JWT_SECRET;
}
function mac(owner: string, d: Omit<DocumentAttachment, "signature">) {
  return createHmac("sha256", secret())
    .update(JSON.stringify([owner, d.name, d.text, d.expires, d.nonce]))
    .digest("hex");
}
export function signDocument(
  owner: string,
  name: string,
  text: string,
): DocumentAttachment {
  const d = {
    name: name.replace(/[\x00-\x1f]/g, "").slice(0, 150),
    text: text.slice(0, MAX_DOCUMENT_TEXT),
    expires: Date.now() + 3600000,
    nonce: randomBytes(16).toString("hex"),
  };
  return { ...d, signature: mac(owner, d) };
}
export function verifyDocument(owner: string, input: unknown) {
  const d = input as DocumentAttachment;
  if (
    !d ||
    typeof d.name !== "string" ||
    d.name.length > 150 ||
    typeof d.text !== "string" ||
    d.text.length > MAX_DOCUMENT_TEXT ||
    typeof d.expires !== "number" ||
    d.expires < Date.now() ||
    typeof d.nonce !== "string" ||
    typeof d.signature !== "string" ||
    !/^[a-f0-9]{64}$/.test(d.signature)
  )
    throw Error("INVALID_ATTACHMENT");
  const expected = mac(owner, d);
  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(d.signature)))
    throw Error("INVALID_ATTACHMENT");
  return d;
}
export async function extractDocument(name: string, buffer: Buffer) {
  if (buffer.length > MAX_DOCUMENT_BYTES) throw Error("FILE_TOO_LARGE");
  const extension = name.split(".").pop()?.toLowerCase();
  let text = "";
  if (["txt", "csv", "md"].includes(extension ?? "")) {
    if (buffer.includes(0)) throw Error("BINARY_FILE_NOT_ALLOWED");
    text = buffer.toString("utf8");
  } else if (extension === "pdf") {
    if (!buffer.subarray(0, 5).equals(Buffer.from("%PDF-")))
      throw Error("INVALID_PDF");
    const mod = await import("pdf-parse/lib/pdf-parse.js"),
      parse = (mod.default ?? mod) as unknown as (
        b: Buffer,
        o: unknown,
      ) => Promise<{ text: string }>;
    text = (await parse(buffer, { max: 40 })).text;
  } else if (extension === "docx" || extension === "xlsx") {
    if (buffer.subarray(0, 2).toString() !== "PK")
      throw Error("INVALID_ARCHIVE");
    const zip = await JSZip.loadAsync(buffer);
    let total = 0;
    for (const file of Object.values(zip.files)) {
      const size =
        (file as unknown as { _data?: { uncompressedSize?: number } })._data
          ?.uncompressedSize ?? 0;
      total += size;
      if (
        size > 10 * 1024 * 1024 ||
        total > 25 * 1024 * 1024 ||
        /vbaProject|externalLinks|embeddings\//i.test(file.name)
      )
        throw Error("UNSAFE_DOCUMENT");
    }
    if (extension === "docx") {
      const mammoth = await import("mammoth");
      text = (await mammoth.extractRawText({ buffer })).value;
    } else {
      const shared = zip.file("xl/sharedStrings.xml"),
        strings: string[] = [];
      if (shared) {
        const xml = await shared.async("string");
        for (const match of xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g))
          strings.push(
            [...match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)]
              .map((m) => m[1])
              .join(""),
          );
      }
      for (const file of Object.values(zip.files)
        .filter((f) => /^xl\/worksheets\/sheet\d+\.xml$/.test(f.name))
        .slice(0, 10)) {
        text += "\n" + file.name + "\n";
        const xml = await file.async("string");
        for (const row of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
          const values = [
            ...row[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g),
          ].map((c) => {
            const v =
              c[2].match(/<v[^>]*>([\s\S]*?)<\/v>/)?.[1] ??
              c[2].match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1] ??
              "";
            return /\bt="s"/.test(c[1]) ? (strings[Number(v)] ?? "") : v;
          });
          text += values.join("\t") + "\n";
          if (text.length > MAX_DOCUMENT_TEXT) break;
        }
      }
    }
  } else throw Error("UNSUPPORTED_FILE_TYPE");
  text = text.replace(/\x00/g, "").trim();
  if (!text) throw Error("NO_SELECTABLE_TEXT");
  return text.slice(0, MAX_DOCUMENT_TEXT);
}
