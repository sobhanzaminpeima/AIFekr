import type { Lang } from "@/lib/i18n/server";
import { SAMPLE_CHARACTERS } from "@/lib/ai/characterSheetPrompts";
import { CHARACTER_GENRES } from "./characterOptions";

/**
 * The character creator for the new design: the classic panel's wording
 * (components/image/CharacterCreationPanel, verbatim, keyed by English), its
 * production styles and its sample people. characterCopy.test.ts fails if
 * the wording drifts from the classic source.
 */
type Four = readonly [string, string, string, string];
export const CHARACTER_STRINGS: Four[] = [
  ["خطا در آپلود عکس", "Photo upload failed", "Foto-Upload fehlgeschlagen", "Photo upload failed"],
  ["خطا در تولید تصویر مرجع", "Reference image generation failed", "Referenzbild-Generierung fehlgeschlagen", "Reference image generation failed"],
  ["نام کاراکتر را وارد کنید", "Enter the character's name", "Geben Sie den Namen der Figur ein", "Enter the character's name"],
  ["خطا در تولید کاراکترشیت", "Character sheet generation failed", "Charakterblatt-Generierung fehlgeschlagen", "Character sheet generation failed"],
  ["یک عکس آپلود کنید یا یکی از کاراکترهای نمونه را انتخاب کنید، مشخصات کاراکترتان را بنویسید و یک «بورد طراحی کاراکتر» سینمایی با چند پنل (چرخش کامل، پرتره، حالت‌های چهره، لباس و لوازم) با همان چهره برایتان می‌سازیم.", "Upload a photo or pick a sample character, fill in your character's brief, and we'll build a cinematic multi-panel \"Character Design Board\" (turnaround, portraits, expressions, wardrobe/materials) — with that same face throughout.", "Laden Sie ein Foto hoch oder wählen Sie einen Beispielcharakter, füllen Sie das Kurzprofil Ihrer Figur aus, und wir erstellen ein filmisches mehrteiliges „Charakter-Design-Board“ (Rundumansicht, Porträts, Mimik, Kleidung/Materialien) — durchgehend mit demselben Gesicht.", "Upload a photo or pick a sample character, fill in your character's brief, and we'll build a cinematic multi-panel \"Character Design Board\" (turnaround, portraits, expressions, wardrobe/materials) — with that same face throughout."],
  ["فقط عکس خودتان یا عکسی را آپلود کنید که اجازهٔ استفاده از آن را دارید.", "Only upload your own photo, or a photo you have permission to use.", "Laden Sie nur Ihr eigenes Foto hoch oder ein Foto, für das Sie die Nutzungsberechtigung haben.", "Only upload your own photo, or a photo you have permission to use."],
  ["۱. یک منبع انتخاب کنید", "1. Choose a source", "1. Quelle auswählen", "1. Choose a source"],
  ["عکس خودتان را آپلود کنید", "Upload your own photo", "Eigenes Foto hochladen", "Upload your own photo"],
  ["انتخاب عکس", "Choose photo", "Foto auswählen", "Choose photo"],
  ["یا یکی از کاراکترهای نمونه را انتخاب کنید", "Or pick a sample character", "Oder einen Beispielcharakter wählen", "Or pick a sample character"],
  ["۲. مشخصات کاراکتر", "2. Character brief", "2. Kurzprofil der Figur", "2. Character brief"],
  ["نام (الزامی)", "Name (required)", "Name (erforderlich)", "Name (required)"],
  ["مثلاً آوا", "e.g. Ava", "z. B. Ava", "e.g. Ava"],
  ["عنوان/تگ‌لاین (اختیاری)", "Title/tagline (optional)", "Titel/Tagline (optional)", "Title/tagline (optional)"],
  ["مثلاً «قهرمان داستان»", "e.g. \"The Protagonist\"", "z. B. „Die Hauptfigur“", "e.g. \"The Protagonist\""],
  ["نقش (اختیاری)", "Role (optional)", "Rolle (optional)", "Role (optional)"],
  ["سبک تولید", "Production style", "Produktionsstil", "Production style"],
  ["شخصیت (اختیاری، ۳-۶ کلمه)", "Personality (optional, 3-6 words)", "Persönlichkeit (optional, 3-6 Wörter)", "Personality (optional, 3-6 words)"],
  ["مثلاً آرام، باهوش، مصمم", "e.g. calm, sharp, determined", "z. B. ruhig, scharfsinnig, entschlossen", "e.g. calm, sharp, determined"],
  ["الهام لباس/استایل (اختیاری)", "Wardrobe/style inspiration (optional)", "Kleidung/Stil-Inspiration (optional)", "Wardrobe/style inspiration (optional)"],
  ["مثلاً لباس شب ابریشمی", "e.g. silk evening wear", "z. B. seidene Abendgarderobe", "e.g. silk evening wear"],
  ["سن ظاهری (اختیاری)", "Age appearance (optional)", "Erscheinungsalter (optional)", "Age appearance (optional)"],
  ["مثلاً اواسط دهه‌ی ۳۰", "e.g. mid-30s", "z. B. Mitte 30", "e.g. mid-30s"],
  ["نقل‌قول شاخص (اختیاری)", "Signature quote (optional)", "Signatur-Zitat (optional)", "Signature quote (optional)"],
  ["رنگ‌های سفارشی (وگرنه پالت مناسب سبک به‌صورت خودکار انتخاب می‌شود)", "Custom colors (otherwise a palette matching the style is chosen automatically)", "Eigene Farben (sonst wird automatisch eine zum Stil passende Palette gewählt)", "Custom colors (otherwise a palette matching the style is chosen automatically)"],
  ["اصلی", "Primary", "Primär", "Primary"],
  ["ثانویه", "Secondary", "Sekundär", "Secondary"],
  ["تأکیدی", "Accent", "Akzent", "Accent"],
  ["در حال ساخت بورد کاراکتر (کمی طول می‌کشد)...", "Building the character board (this takes a bit)...", "Charakter-Board wird erstellt (dauert etwas)...", "Building the character board (this takes a bit)..."],
  ["ساخت بورد کاراکتر", "Generate Character Board", "Charakter-Board erstellen", "Generate Character Board"],
  ["دانلود کاراکترشیت", "Download Character Sheet", "Charakterblatt herunterladen", "Download Character Sheet"],
  ["کاراکترشیت‌های ذخیره‌شدهٔ من", "My Saved Character Sheets", "Meine gespeicherten Charakterblätter", "My Saved Character Sheets"],
  ["هنوز کاراکترشیتی ذخیره نشده", "No character sheets saved yet", "Noch keine Charakterblätter gespeichert", "No character sheets saved yet"],
];

const COL: Record<Lang, number> = { fa: 0, en: 1, de: 2, tr: 3 };
export function characterCopy(lang: Lang) {
  const pick = (o: { fa: string; en: string; de: string }) => (lang === "fa" ? o.fa : lang === "de" ? o.de : o.en);
  return {
    strings: Object.fromEntries(CHARACTER_STRINGS.map((row) => [row[1], row[COL[lang]]])) as Record<string, string>,
    genres: CHARACTER_GENRES.map((g) => ({ value: g.value, label: pick(g) })),
    // The portrait prompt is sent back by the browser to /api/image/generate, as in the classic panel.
    samples: SAMPLE_CHARACTERS.map((c) => ({ id: c.id, label: pick({ fa: c.labelFa, en: c.labelEn, de: c.labelDe }), portraitPrompt: c.portraitPrompt })),
  };
}
