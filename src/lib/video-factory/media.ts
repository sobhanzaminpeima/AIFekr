import type { Manifest } from "./domain";

/**
 * The project's media library, Google-Flow style: every shot of the script in
 * order with its image prompt and its image. Shots are numbered SHOT_001… so
 * prompts can be pasted into bulk image tools and images dropped back in by
 * filename.
 */
export type ShotMedia = { order: number; code: string; id: string; chapter: number; title: string; narration: string; visualPrompt: string; assetId: string | null };

export const shotCode = (order: number) => `SHOT_${String(order).padStart(3, "0")}`;

export function shotMedia(manifest: Manifest): ShotMedia[] {
  let order = 0;
  return manifest.chapters.flatMap((chapter, c) => chapter.shots.map((s) => {
    order += 1;
    return { order, code: shotCode(order), id: s.id, chapter: c + 1, title: s.title, narration: s.narration, visualPrompt: s.visualPrompt, assetId: s.assetId ?? null };
  }));
}

/** "[SHOT 1] prompt" blocks for bulk image tools; the style bible is appended once per shot so each line stands alone. */
export function promptList(shots: ShotMedia[], styleBible = ""): string {
  const style = styleBible.trim();
  return shots.map((s) => `[SHOT ${s.order}]\n${s.visualPrompt.trim()}${style ? `\nStyle: ${style}` : ""}`).join("\n\n") + "\n";
}

/** The shot a dropped file belongs to: SHOT_012.png, shot-12.jpg, 012.webp or "Shot 12 final.png". */
export function shotForFilename(name: string, shots: ShotMedia[]): ShotMedia | null {
  const base = name.replace(/\.[a-z0-9]+$/i, "");
  const m = base.match(/shot[\s_-]*0*(\d{1,4})/i) ?? base.match(/^0*(\d{1,4})$/);
  if (!m) return null;
  const order = Number(m[1]);
  return shots.find((s) => s.order === order) ?? null;
}

/** Sets or clears one shot's image without touching anything else in the script. */
export function withShotAsset(manifest: Manifest, shotId: string, assetId: string | null, bumpRevision = false): Manifest {
  let found = false;
  const chapters = manifest.chapters.map((c) => ({
    ...c,
    shots: c.shots.map((s) => {
      if (s.id !== shotId) return s;
      found = true;
      const next = { ...s, revision: bumpRevision ? (s.revision ?? 0) + 1 : s.revision };
      if (assetId) next.assetId = assetId; else delete next.assetId;
      return next;
    }),
  }));
  if (!found) throw new Error("SHOT_NOT_FOUND");
  return { ...manifest, chapters };
}

// ── A small stored (uncompressed) ZIP writer: images are already compressed. ──
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
export function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function storedZip(files: { name: string; data: Buffer }[]): Buffer {
  const parts: Buffer[] = [], central: Buffer[] = [];
  let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.name, "utf8"), crc = crc32(f.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(0, 8);
    local.writeUInt32LE(0, 10); local.writeUInt32LE(crc, 14); local.writeUInt32LE(f.data.length, 18); local.writeUInt32LE(f.data.length, 22);
    local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28);
    parts.push(local, name, f.data);
    const head = Buffer.alloc(46);
    head.writeUInt32LE(0x02014b50, 0); head.writeUInt16LE(20, 4); head.writeUInt16LE(20, 6); head.writeUInt16LE(0x0800, 8); head.writeUInt16LE(0, 10);
    head.writeUInt32LE(0, 12); head.writeUInt32LE(crc, 16); head.writeUInt32LE(f.data.length, 20); head.writeUInt32LE(f.data.length, 24);
    head.writeUInt16LE(name.length, 28); head.writeUInt32LE(offset, 42);
    central.push(head, name);
    offset += 30 + name.length + f.data.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cd, end]);
}
