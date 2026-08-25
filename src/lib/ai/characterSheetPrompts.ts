/**
 * Character Creation (image generation submenu) — builds a reusable
 * "character sheet" reference image (multiple face/body angles in one
 * image, with short Persian panel labels) from either a user-uploaded
 * photo or one of 8 sample AI-generated reference people.
 *
 * The prompt text below is the user-supplied template, kept close to
 * verbatim (only "attached image" -> "reference image", since the image
 * is passed as `sourceImageUrl` to the existing image-to-image path
 * rather than literally attached in a chat message). Panel labels are
 * deliberately Persian-only regardless of UI language, per the
 * template's own explicit requirement — this is about the generated
 * image's content, not the surrounding app UI (which stays trilingual).
 */

export interface SampleCharacter {
  id: string;
  labelFa: string;
  labelEn: string;
  labelDe: string;
  /** Prompt used to generate the reference portrait itself (step 1) — not the character sheet. */
  portraitPrompt: string;
}

// Matches the 8 ready-made reference faces from the source workflow guide
// (Alvana Academy) — same idea: pick a plausible face here instead of
// publishing your own if you'd rather not.
export const SAMPLE_CHARACTERS: SampleCharacter[] = [
  { id: "A", labelFa: "مرد · موی کوتاه فر · دیوار بتنی", labelEn: "Man · short curly hair · concrete wall", labelDe: "Mann · kurzes lockiges Haar · Betonwand",
    portraitPrompt: "Photorealistic studio portrait of an adult man, short curly dark hair, natural skin texture, standing in front of a plain concrete wall, soft even daylight, neutral serious expression, front-facing, shot on a DSLR with a portrait lens." },
  { id: "B", labelFa: "مرد · موی فر · نور گرم", labelEn: "Man · curly hair · warm light", labelDe: "Mann · lockiges Haar · warmes Licht",
    portraitPrompt: "Photorealistic studio portrait of an adult man, curly medium-length hair, natural skin texture, warm golden-hour lighting, neutral serious expression, front-facing, shot on a DSLR with a portrait lens." },
  { id: "C", labelFa: "زن · موی بلوند لخت", labelEn: "Woman · straight blonde hair", labelDe: "Frau · glattes blondes Haar",
    portraitPrompt: "Photorealistic studio portrait of an adult woman, long straight blonde hair, natural skin texture, soft even studio lighting, neutral serious expression, front-facing, shot on a DSLR with a portrait lens." },
  { id: "D", labelFa: "مرد · موی موج‌دار · ژاکت خاکستری", labelEn: "Man · wavy hair · gray jacket", labelDe: "Mann · welliges Haar · graue Jacke",
    portraitPrompt: "Photorealistic studio portrait of an adult man, wavy dark hair, wearing a plain gray jacket, natural skin texture, soft even studio lighting, neutral serious expression, front-facing, shot on a DSLR with a portrait lens." },
  { id: "E", labelFa: "زن · موی موج‌دار · گردنبند", labelEn: "Woman · wavy hair · necklace", labelDe: "Frau · welliges Haar · Halskette",
    portraitPrompt: "Photorealistic studio portrait of an adult woman, wavy shoulder-length hair, wearing a simple necklace, natural skin texture, soft even studio lighting, neutral serious expression, front-facing, shot on a DSLR with a portrait lens." },
  { id: "F", labelFa: "زن · استودیویی · لباس ساتن", labelEn: "Woman · studio · satin outfit", labelDe: "Frau · Studio · Satin-Outfit",
    portraitPrompt: "Photorealistic studio portrait of an adult woman, sleek styled hair, wearing an elegant satin outfit, natural skin texture, professional studio lighting, neutral serious expression, front-facing, shot on a DSLR with a portrait lens." },
  { id: "G", labelFa: "زن · موی فر پرحجم", labelEn: "Woman · voluminous curly hair", labelDe: "Frau · voluminöses lockiges Haar",
    portraitPrompt: "Photorealistic studio portrait of an adult woman, voluminous curly hair, natural skin texture, soft even studio lighting, neutral serious expression, front-facing, shot on a DSLR with a portrait lens." },
  { id: "H", labelFa: "مرد · ریش کوتاه · دیوار کرم", labelEn: "Man · short beard · cream wall", labelDe: "Mann · kurzer Bart · cremefarbene Wand",
    portraitPrompt: "Photorealistic studio portrait of an adult man, short well-groomed beard, short hair, natural skin texture, standing in front of a plain cream-colored wall, soft even daylight, neutral serious expression, front-facing, shot on a DSLR with a portrait lens." },
];

export const CHARACTER_SHEET_PROMPT = `Create a character sheet using the person/character in the reference image as the primary reference, ensuring it depicts the exact same person/character.

If the reference image is a photograph, maintain a photorealistic style. If it is an illustration, anime, manga, 3D, or caricature style, preserve that exact art style, linework, coloring, texture, and level of deformation. Do not convert it into a different style.

The purpose is not for a profile introduction, but as visual reference material for character creation, AI image generation, and model consistency.

Do not include profile elements such as name, age, personality, hobbies, biography, or descriptive text.

Text inside the image must be only short Persian/Farsi labels for each panel. Do not use English, Japanese, Chinese, or long explanatory text. The Persian labels must be clean, readable, correctly written from right to left, and placed neatly above or inside each panel.

Image format:
A single wide image in 16:9 aspect ratio. White to light gray background. High resolution. Clean, easy-to-read character sheet layout organized with thin ruled lines or boxes.

Primary conditions:
Faithfully reproduce the same face, eyes, eyebrows, nose, mouth, facial contours, hairstyle, hair color, skin tone, skin texture, body type, overall atmosphere, and clothing impression from the original image.

Do not make it a different person or character.
Do not excessively beautify, simplify, redesign, or stylize the face.
Do not change the hairstyle, hair color, facial hair, skin tone, or body type.
Exclude temporary small items, food, background objects, poses, or handheld items from the original image unless necessary for the character design.

Clothing:
If the clothing in the original image is clear, maintain it.
If the full body is not visible, naturally complete the outfit in a way that fits the original atmosphere.
For front, side, and back views, keep the same clothing, same hairstyle, same body type, and same overall character identity consistent.
Avoid excessive exposure, underwear, swimsuits, or sexualized outfits.

Content to include:

[Full body]
Front view, side view, back view.
Use Persian labels: تمام‌قد، نمای روبه‌رو، نمای نیم‌رخ، نمای پشت

[Face close-up]
Front face, profile, 45-degree angle.
Use Persian labels: صورت، روبه‌رو، نیم‌رخ، سه‌رخ

[Expressions]
Neutral, smile, beaming smile, serious, surprised, embarrassed, thinking, troubled.
Use Persian labels: حالات چهره، خنثی، لبخند، خنده کامل، جدی، متعجب، خجالتی، در حال فکر، ناراحت

[Face parts]
Eyes, eyebrows, nose, mouth, ears, face contour, skin, texture.
Use Persian labels: جزئیات صورت، چشم‌ها، ابروها، بینی، دهان، گوش‌ها، فرم صورت، پوست، بافت پوست

[Hair details]
Front hairline, side hair, back hair, hair flow.
Use Persian labels: جزئیات مو، خط رویش مو، موی کناری، پشت مو، جهت خواب مو

[Other angles]
Diagonal left, diagonal right, from above, from below, back of head.
Use Persian labels: زاویه‌های دیگر، سه‌رخ چپ، سه‌رخ راست، از بالا، از پایین، پشت سر

Layout:
Make it easy to read as professional reference material.
Use clean margins, thin boxes, organized rows and columns, and consistent spacing.
Do not make it look like a magazine profile, resume, poster, social media design, or introduction page.
Do not include long text blocks.
Only use short Persian labels.

Negative specifications:
Different person, changed identity, changed face, changed hairstyle, changed hair color, changed body type, inconsistent clothing, arbitrary photorealistic conversion, arbitrary anime conversion, excessive beautification, excessive simplification, profile text, name, age, personality, hobbies, English labels, Japanese labels, Chinese labels, long explanatory text, garbled Persian text, incorrect right-to-left text, hard-to-read text, sloppy layout, low resolution, distorted face, weird eyes, hand errors, finger errors, duplicated faces, sexualized outfits, underwear, swimsuits, unnecessary small items, holding food in mouth, random objects, cluttered background.`;
