// Character Creator — builds a multi-panel "Character Design Board" from a
// user's uploaded face photo + a short brief, using the SAME face-lock
// reference-image pipeline (generateImageFromReference) already used
// elsewhere in /image/generate — no parallel image-gen system.
//
// Why three separate generations instead of one mega-prompt: a single
// gpt-image-2 edit call has no guarantee of keeping the face consistent
// across many different poses/crops packed into one image -- it's an
// edit/inpaint model, not a dedicated multi-view identity-lock system
// (no InstantID/PhotoMaker/IP-Adapter-FaceID wired into this project).
// Three focused calls, each given the SAME reference photo and asked for
// ONE self-consistent panel (turnaround row, portrait grid, expression
// row), keep the ask inside what the model can actually do reliably. The
// fabric/accessories panel and the info/bio panel are rendered
// programmatically (no AI, no face involved) and composited alongside them
// with sharp, which this project already depends on.
import sharp from "sharp";
import * as openaiImage from "./openaiImage";
import * as qwen from "./qwen";

export type Genre =
  | "cinematic_drama" | "luxury_editorial" | "sci_fi" | "fantasy"
  | "business_corporate" | "streetwear_urban" | "minimal_tech";

export interface CharacterBrief {
  name: string;
  title?: string;
  role?: string;
  genre: Genre;
  personality?: string;
  wardrobe?: string;
  age?: string;
  height?: string;
  origin?: string;
  quote?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
}

const GENRE_LABEL: Record<Genre, string> = {
  cinematic_drama: "cinematic drama",
  luxury_editorial: "luxury editorial fashion",
  sci_fi: "science fiction",
  fantasy: "fantasy",
  business_corporate: "business / corporate",
  streetwear_urban: "streetwear / urban",
  minimal_tech: "minimal tech",
};

// A palette PER genre, several options each, so two users picking the same
// genre don't get an identical board -- varied, not one hardcoded default.
const GENRE_PALETTES: Record<Genre, [string, string, string][]> = {
  cinematic_drama: [["#1a1a2e", "#16213e", "#e94560"], ["#2b2d42", "#8d99ae", "#ef233c"]],
  luxury_editorial: [["#111111", "#3a3a3a", "#ea580c"], ["#0d0d0d", "#c9a86a", "#f5f5f0"]],
  sci_fi: [["#0a0e27", "#1b2a4a", "#00d4ff"], ["#0d1b2a", "#1b263b", "#7cf5d1"]],
  fantasy: [["#22223b", "#4a4e69", "#c9ada7"], ["#2d1b2e", "#6a4c93", "#d4af37"]],
  business_corporate: [["#0f172a", "#1e293b", "#3b82f6"], ["#0c1e3e", "#334155", "#0ea5e9"]],
  streetwear_urban: [["#161616", "#e63946", "#f1faee"], ["#101010", "#ffb703", "#fb8500"]],
  minimal_tech: [["#0d0d0d", "#2d2d2d", "#00c2a8"], ["#111827", "#374151", "#6ee7b7"]],
};

function pickPalette(genre: Genre, seed: string): [string, string, string] {
  const options = GENRE_PALETTES[genre];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return options[hash % options.length];
}

/** Conditionally-included clauses per the field-mapping rules: a blank optional field is OMITTED, never rendered as an empty/placeholder-looking bracket. */
function clause(label: string, value?: string): string {
  return value?.trim() ? `${label} ${value.trim()}` : "";
}

function baseIdentityLine(brief: CharacterBrief, wardrobe: string): string {
  const parts = [
    "STRICT FACE LOCK using the uploaded reference photo, exact facial identity preservation, same person, photorealistic",
    `${GENRE_LABEL[brief.genre]} production styling`,
    clause("age", brief.age),
    wardrobe ? `wearing ${wardrobe}` : "",
    clause("personality conveyed through posture and expression:", brief.personality),
  ].filter(Boolean);
  return parts.join(", ");
}

function resolveWardrobe(brief: CharacterBrief): string {
  return brief.wardrobe?.trim() || `${GENRE_LABEL[brief.genre]} appropriate wardrobe`;
}

interface PanelPrompts {
  turnaround: string;
  portraits: string;
  expressions: string;
}

export function buildPanelPrompts(brief: CharacterBrief): PanelPrompts {
  const wardrobe = resolveWardrobe(brief);
  const identity = baseIdentityLine(brief, wardrobe);
  return {
    turnaround: `${identity}, full-body character turnaround reference sheet, four views arranged left to right in one image: front view, three-quarter view, side view, back view, consistent pose baseline and studio lighting, neutral gray studio background, fashion production reference sheet aesthetic, 8K detail`,
    portraits: `${identity}, a 2x2 grid of four distinct cinematic portrait studies of the same person, varying angle and framing (close-up, medium shot, profile, over-the-shoulder), consistent identity across all four, editorial studio lighting, ${GENRE_LABEL[brief.genre]} mood, museum-quality photography`,
    expressions: `${identity}, facial expression reference sheet, four close-up headshots arranged left to right, same camera angle and lighting across all four, four different expressions: neutral, soft smile, focused, reassuring, consistent identity and framing, casting-sheet aesthetic`,
  };
}

async function generatePanel(prompt: string, referenceImageUrl: string, ratio: "16:9" | "1:1"): Promise<Buffer> {
  const provider = openaiImage.isOpenAIImageAvailable ? openaiImage : qwen;
  const urls = await provider.generateImageFromReference({ prompt, style: "cinematic", ratio, count: 1, imageUrl: referenceImageUrl });
  const url = urls[0];
  if (url.startsWith("data:")) return Buffer.from(url.split(",")[1] || "", "base64");
  const res = await fetch(url);
  return Buffer.from(await res.arrayBuffer());
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Wraps a string onto multiple SVG <tspan> lines at roughly `maxChars` per line — SVG has no native text wrapping. */
function wrapLines(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    if ((current + " " + w).trim().length > maxChars && current) {
      lines.push(current.trim());
      current = w;
    } else {
      current = (current + " " + w).trim();
    }
  }
  if (current) lines.push(current);
  return lines;
}

function infoPanelSvg(brief: CharacterBrief, palette: [string, string, string], width: number, height: number): string {
  const [primary, secondary, accent] = [brief.primaryColor || palette[0], brief.secondaryColor || palette[1], brief.accentColor || palette[2]];
  const bioLines = wrapLines(brief.personality || GENRE_LABEL[brief.genre], 28);
  let y = 210;
  const rows: string[] = [];
  function field(label: string, value?: string) {
    if (!value?.trim()) return;
    rows.push(`<text x="40" y="${y}" font-family="Arial" font-size="13" fill="#888" letter-spacing="2">${escapeXml(label.toUpperCase())}</text>`);
    rows.push(`<text x="40" y="${y + 20}" font-family="Georgia, serif" font-size="16" fill="#eee">${escapeXml(value)}</text>`);
    y += 46;
  }
  field("Title", brief.title);
  field("Role", brief.role);
  field("Age", brief.age);
  field("Height", brief.height);
  field("Origin", brief.origin);

  const bioY = y + 10;
  const bioSvg = bioLines.map((l, i) => `<tspan x="40" dy="${i === 0 ? 0 : 18}">${escapeXml(l)}</tspan>`).join("");
  const quoteBlock = brief.quote?.trim()
    ? `<text x="40" y="${height - 90}" font-family="Georgia, serif" font-style="italic" font-size="15" fill="#ddd">${wrapLines(`"${brief.quote}"`, 34).map((l, i) => `<tspan x="40" dy="${i === 0 ? 0 : 20}">${escapeXml(l)}</tspan>`).join("")}</text>`
    : "";

  return `
  <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${width}" height="${height}" fill="#0c0c10"/>
    <text x="40" y="70" font-family="Georgia, serif" font-size="42" font-weight="bold" fill="#ffffff">${escapeXml(brief.name)}</text>
    <rect x="40" y="90" width="60" height="3" fill="${accent}"/>
    <text x="40" y="130" font-family="Arial" font-size="13" letter-spacing="4" fill="#999">CHARACTER DESIGN BOARD</text>
    ${rows.join("\n")}
    <text x="40" y="${bioY}" font-family="Arial" font-size="12" fill="#999" letter-spacing="2">PERSONALITY</text>
    <text x="40" y="${bioY + 20}" font-family="Arial" font-size="14" fill="#ccc">${bioSvg}</text>
    <text x="40" y="${height - 150}" font-family="Arial" font-size="12" fill="#999" letter-spacing="2">COLOR PALETTE</text>
    <circle cx="55" cy="${height - 125}" r="14" fill="${primary}" stroke="#333"/>
    <circle cx="95" cy="${height - 125}" r="14" fill="${secondary}" stroke="#333"/>
    <circle cx="135" cy="${height - 125}" r="14" fill="${accent}" stroke="#333"/>
    ${quoteBlock}
    <text x="40" y="${height - 24}" font-family="Arial" font-size="10" fill="#555" letter-spacing="1">aifekr.com</text>
  </svg>`;
}

function materialsPanelSvg(brief: CharacterBrief, palette: [string, string, string], width: number, height: number): string {
  const [primary, secondary, accent] = [brief.primaryColor || palette[0], brief.secondaryColor || palette[1], brief.accentColor || palette[2]];
  const wardrobeLines = wrapLines(resolveWardrobe(brief), 36);
  return `
  <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${width}" height="${height}" fill="#0c0c10"/>
    <text x="30" y="46" font-family="Georgia, serif" font-size="20" fill="#fff">WARDROBE &amp; MATERIALS</text>
    <rect x="30" y="60" width="40" height="2" fill="${accent}"/>
    <rect x="30" y="90" width="${width - 60}" height="80" rx="6" fill="${primary}"/>
    <rect x="30" y="180" width="${(width - 72) / 2}" height="80" rx="6" fill="${secondary}"/>
    <rect x="${42 + (width - 72) / 2}" y="180" width="${(width - 72) / 2}" height="80" rx="6" fill="${accent}"/>
    <text x="30" y="300" font-family="Arial" font-size="12" fill="#999" letter-spacing="2">STYLE NOTES</text>
    <text x="30" y="324" font-family="Arial" font-size="14" fill="#ccc">${wardrobeLines.map((l, i) => `<tspan x="30" dy="${i === 0 ? 0 : 20}">${escapeXml(l)}</tspan>`).join("")}</text>
  </svg>`;
}

export interface CharacterBoardResult {
  buffer: Buffer;
}

/** Generates the three AI panels (in parallel) + two programmatic panels, then composites all five into one 1920x1080 board. */
export async function generateCharacterBoard(brief: CharacterBrief, referenceImageUrl: string): Promise<CharacterBoardResult> {
  const prompts = buildPanelPrompts(brief);
  const palette = pickPalette(brief.genre, brief.name + brief.genre);

  const [turnaroundBuf, portraitsBuf, expressionsBuf] = await Promise.all([
    generatePanel(prompts.turnaround, referenceImageUrl, "16:9"),
    generatePanel(prompts.portraits, referenceImageUrl, "1:1"),
    generatePanel(prompts.expressions, referenceImageUrl, "16:9"),
  ]);

  const CANVAS_W = 1920;
  const CANVAS_H = 1080;
  const LEFT_W = 460;
  const MID_W = 840;
  const RIGHT_W = CANVAS_W - LEFT_W - MID_W;
  const TOP_H = 560;
  const BOTTOM_H = CANVAS_H - TOP_H;

  const [infoPng, turnaroundResized, portraitsResized, expressionsResized, materialsPng] = await Promise.all([
    sharp(Buffer.from(infoPanelSvg(brief, palette, LEFT_W, CANVAS_H))).png().toBuffer(),
    sharp(turnaroundBuf).resize(MID_W, TOP_H, { fit: "cover" }).toBuffer(),
    sharp(portraitsBuf).resize(RIGHT_W, TOP_H, { fit: "cover" }).toBuffer(),
    sharp(expressionsBuf).resize(MID_W, BOTTOM_H, { fit: "cover" }).toBuffer(),
    sharp(Buffer.from(materialsPanelSvg(brief, palette, RIGHT_W, BOTTOM_H))).png().toBuffer(),
  ]);

  const board = await sharp({ create: { width: CANVAS_W, height: CANVAS_H, channels: 3, background: "#0c0c10" } })
    .composite([
      { input: infoPng, left: 0, top: 0 },
      { input: turnaroundResized, left: LEFT_W, top: 0 },
      { input: portraitsResized, left: LEFT_W + MID_W, top: 0 },
      { input: expressionsResized, left: LEFT_W, top: TOP_H },
      { input: materialsPng, left: LEFT_W + MID_W, top: TOP_H },
    ])
    .png()
    .toBuffer();

  return { buffer: board };
}
