/**
 * Rule-based content-quality scoring for an Instagram caption.
 *
 * The module used to generate captions and never grade them — the owner had
 * no way to tell a strong generation from a weak one before scheduling it.
 * This is deliberately deterministic (no AI call, no cost, no latency): it
 * runs on every generation and in the wizard as the owner edits. It advises,
 * it never blocks.
 */

export type QualityCode =
  | "weak_hook"
  | "too_short"
  | "too_long"
  | "no_cta"
  | "too_few_hashtags"
  | "too_many_hashtags"
  | "generic_hashtags"
  | "emoji_spam"
  | "all_caps"
  | "format_mismatch";

export interface QualityFinding {
  code: QualityCode;
  /** How many points this cost. */
  penalty: number;
  facts: Record<string, number | string>;
}

export interface QualityResult {
  score: number; // 0-100
  band: "strong" | "ok" | "weak";
  findings: QualityFinding[];
}

/** Instagram truncates the caption at roughly this many characters behind "... more". */
const HOOK_WINDOW = 125;

const CTA_PATTERNS = [
  /\?\s*$/m,                                  // ends on a question
  /کامنت|نظرت|سیو|ذخیره|دایرکت|بفرست|لینک بیو|بزن/i,
  /comment|save this|share|dm us|link in bio|tap|swipe|tell us/i,
  /kommentier|speicher|teile|schreib uns|link in bio/i,
];

const GENERIC_TAGS = new Set([
  "love", "instagood", "photooftheday", "fashion", "beautiful", "happy", "cute",
  "like4like", "follow", "followme", "picoftheday", "art", "instadaily",
  "ایران", "تهران", "فالو", "لایک", "پیج",
]);

export interface ScoreInput {
  caption: string;
  hashtags?: string[];
  /** "REELS" | "IMAGE" | "CAROUSEL_ALBUM" | "VIDEO" — affects the length band. */
  format?: string | null;
}

export function scoreContent({ caption, hashtags = [], format }: ScoreInput): QualityResult {
  const text = (caption || "").trim();
  const findings: QualityFinding[] = [];
  let score = 100;

  const add = (code: QualityCode, penalty: number, facts: Record<string, number | string>) => {
    findings.push({ code, penalty, facts });
    score -= penalty;
  };

  const len = text.length;
  const hook = text.slice(0, HOOK_WINDOW);

  // ── Length bands, per format ────────────────────────────────────────────
  const isReel = format === "REELS" || format === "VIDEO";
  const minLen = isReel ? 40 : 80;
  const maxLen = isReel ? 900 : 1600;
  if (len < minLen) add("too_short", 20, { length: len, min: minLen });
  else if (len > maxLen) add("too_long", 10, { length: len, max: maxLen });

  // ── Hook: something concrete has to land before the "more" cut-off ──────
  // A hook is weak when the visible window is a bare label with no question,
  // number, or second sentence to pull the reader in.
  const hookHasQuestion = /[?؟]/.test(hook);
  const hookHasNumber = /\d/.test(hook);
  const hookSentences = hook.split(/[.!?؟\n]/).filter((s) => s.trim().length > 12).length;
  if (len >= minLen && !hookHasQuestion && !hookHasNumber && hookSentences < 2) {
    add("weak_hook", 20, { hookChars: hook.length, sentences: hookSentences });
  }

  // ── Call to action ──────────────────────────────────────────────────────
  if (!CTA_PATTERNS.some((re) => re.test(text))) add("no_cta", 15, { length: len });

  // ── Hashtags ────────────────────────────────────────────────────────────
  const tags = hashtags.map((h) => h.replace(/^#/, "").trim().toLowerCase()).filter(Boolean);
  if (tags.length < 3) add("too_few_hashtags", 10, { count: tags.length });
  else if (tags.length > 15) add("too_many_hashtags", 10, { count: tags.length });
  const genericCount = tags.filter((t) => GENERIC_TAGS.has(t)).length;
  if (tags.length > 0 && genericCount / tags.length >= 0.5) {
    add("generic_hashtags", 10, { generic: genericCount, total: tags.length });
  }

  // ── Spam signals ────────────────────────────────────────────────────────
  // Counted via surrogate pairs + the common BMP symbol blocks rather than
  // \p{Extended_Pictographic}, which needs an ES6 regex target this build
  // doesn't compile to. Close enough for a spam heuristic.
  const emojiCount =
    (text.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g) || []).length +
    (text.match(/[☀-➿⬀-⯿️]/g) || []).length;
  if (len > 0 && emojiCount > Math.max(8, len / 40)) add("emoji_spam", 8, { emojis: emojiCount, length: len });

  const latin = text.replace(/[^A-Za-z]/g, "");
  if (latin.length >= 25) {
    const upper = (text.match(/[A-Z]/g) || []).length;
    if (upper / latin.length > 0.6) add("all_caps", 8, { upperRatio: Math.round((upper / latin.length) * 100) });
  }

  // ── Format fit: a numbered list crammed into one static image ───────────
  const listItems = (text.match(/^\s*(\d+[.)]|[-•])\s+/gm) || []).length;
  if (listItems >= 3 && format === "IMAGE") {
    add("format_mismatch", 10, { listItems, format: "IMAGE" });
  }

  score = Math.max(0, Math.min(100, score));
  return { score, band: score >= 75 ? "strong" : score >= 50 ? "ok" : "weak", findings };
}

/** Localised advice for a finding — kept next to the rules so they can't drift apart. */
export function qualityMessage(f: QualityFinding, lang: "fa" | "en" | "de" | "tr"): string {
  const m: Record<QualityCode, { fa: string; en: string; de: string; tr: string }> = {
    weak_hook: {
      fa: "شروع کپشن قلاب ندارد — قبل از «بیشتر» یک سؤال، عدد یا نتیجه‌ی مشخص بیاور.",
      en: "The opening has no hook — put a question, a number, or a concrete result before the “more” cut-off.",
      de: "Der Einstieg hat keinen Hook — setze eine Frage, eine Zahl oder ein konkretes Ergebnis vor das „mehr“.",
      tr: "The opening has no hook — put a question, a number, or a concrete result before the “more” cut-off.",
    },
    too_short: { fa: `کپشن خیلی کوتاه است (${f.facts.length} کاراکتر).`, en: `Caption is too short (${f.facts.length} chars).`, de: `Bildunterschrift zu kurz (${f.facts.length} Zeichen).`, tr: `Caption is too short (${f.facts.length} chars).` },
    too_long: { fa: `کپشن خیلی بلند است (${f.facts.length} کاراکتر) — کوتاه‌ترش کن.`, en: `Caption is long (${f.facts.length} chars) — tighten it.`, de: `Bildunterschrift lang (${f.facts.length} Zeichen) — kürzen.`, tr: `Caption is long (${f.facts.length} chars) — tighten it.` },
    no_cta: {
      fa: "دعوت به اقدام ندارد — یک سؤال بپرس یا بگو کامنت/سیو کنند.",
      en: "No call to action — ask a question or invite a comment/save.",
      de: "Kein Call-to-Action — stelle eine Frage oder bitte um Kommentar/Speichern.",
      tr: "No call to action — ask a question or invite a comment/save.",
    },
    too_few_hashtags: { fa: `فقط ${f.facts.count} هشتگ دارد — ۵ تا ۱۰ هشتگ مرتبط بهتر است.`, en: `Only ${f.facts.count} hashtags — 5–10 relevant ones works better.`, de: `Nur ${f.facts.count} Hashtags — 5–10 relevante sind besser.`, tr: `Only ${f.facts.count} hashtags — 5–10 relevant ones works better.` },
    too_many_hashtags: { fa: `${f.facts.count} هشتگ زیاد است.`, en: `${f.facts.count} hashtags is too many.`, de: `${f.facts.count} Hashtags sind zu viele.`, tr: `${f.facts.count} hashtags is too many.` },
    generic_hashtags: {
      fa: "هشتگ‌ها عمومی‌اند — هشتگ تخصصی حوزه‌ی خودت مخاطب دقیق‌تری می‌آورد.",
      en: "Hashtags are generic — niche tags for your field reach a better-matched audience.",
      de: "Hashtags sind generisch — Nischen-Tags erreichen ein passenderes Publikum.",
      tr: "Hashtags are generic — niche tags for your field reach a better-matched audience.",
    },
    emoji_spam: { fa: `${f.facts.emojis} ایموجی زیاد است.`, en: `${f.facts.emojis} emojis is too many.`, de: `${f.facts.emojis} Emojis sind zu viele.`, tr: `${f.facts.emojis} emojis is too many.` },
    all_caps: { fa: "بیش از حد حروف بزرگ — شبیه اسپم دیده می‌شود.", en: "Too much ALL CAPS — reads as spam.", de: "Zu viel GROSSSCHREIBUNG — wirkt wie Spam.", tr: "Too much ALL CAPS — reads as spam." },
    format_mismatch: {
      fa: `${f.facts.listItems} مورد فهرست در یک عکس ثابت — کاروسل بهتر جواب می‌دهد.`,
      en: `${f.facts.listItems} list items on a single image — a carousel performs better.`,
      de: `${f.facts.listItems} Listenpunkte auf einem Bild — ein Karussell funktioniert besser.`,
      tr: `${f.facts.listItems} list items on a single image — a carousel performs better.`,
    },
  };
  return m[f.code][lang];
}
