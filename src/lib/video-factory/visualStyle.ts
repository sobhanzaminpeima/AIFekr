import { z } from "zod";

/** The four visual modes offered to creators; NONE keeps the free-text style bible only. */
export const visualStyles = ["NONE", "STICKMAN", "CUSTOM_CHARACTER", "CINEMATIC", "HYBRID"] as const;
export type VisualStyle = typeof visualStyles[number];

export const visualBibleSchema = z.object({
  palette: z.string().max(400).default(""),
  lighting: z.string().max(400).default(""),
  era: z.string().max(400).default(""),
  composition: z.string().max(400).default(""),
  locations: z.string().max(600).default(""),
  branding: z.string().max(300).default(""),
  negative: z.string().max(600).default(""),
}).strict();
export type VisualBible = z.infer<typeof visualBibleSchema>;

const PRESET: Record<Exclude<VisualStyle, "NONE">, string> = {
  STICKMAN: "Stickman documentary: clean 2D stylised figures with round white heads and minimal facial features, clothing that fits the period, detailed and coherent backgrounds, flat even colours, crisp outlines.",
  CUSTOM_CHARACTER: "Original recurring character illustration: the same character design, age, outfit, colours and proportions in every scene; expressive poses; no resemblance to real people.",
  CINEMATIC: "Cinematic documentary still: illustrative, realistic lighting and lenses, accurate period details, dramatic but truthful staging; a dramatisation, not archival footage.",
  HYBRID: "Hybrid storytelling: one consistent look that mixes recurring characters, environment stills and clean editorial diagrams.",
};
/** Generated images must never contain text; titles, captions and numbers are rendered by the editor. */
const NO_TEXT = "No text, letters, numbers, captions, logos or watermarks inside the image.";

/**
 * The style block appended to every image prompt (and to the prompt export).
 * With no preset and an empty bible it is exactly the old free-text style bible,
 * so existing projects keep their prompts and their already-paid images.
 */
export function styleText(configuration: { styleBible: string; visualStyle?: VisualStyle; visualBible?: Partial<VisualBible> }) {
  const style = configuration.visualStyle ?? "NONE", bible = configuration.visualBible ?? {};
  const rows = ([["Palette", bible.palette], ["Lighting and line", bible.lighting], ["Era and setting", bible.era], ["Composition", bible.composition], ["Recurring locations", bible.locations], ["Channel branding colours", bible.branding], ["Avoid", bible.negative]] as const)
    .filter(([, v]) => v && v.trim()).map(([k, v]) => `${k}: ${v!.trim()}`);
  if (style === "NONE" && !rows.length) return configuration.styleBible;
  return [style !== "NONE" ? PRESET[style] : "", configuration.styleBible.trim(), ...rows, NO_TEXT].filter(Boolean).join("\n");
}
