import type { Lang } from "@/lib/i18n";

/**
 * Output sanity guard (roadmap E11), checked before an answer is saved or
 * charged: an answer in the wrong script for the language the user asked in is
 * treated like an off-topic answer. Mixed text (Latin product names, code,
 * numbers) is normal, so only a clear mismatch counts.
 */
const PERSIAN = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/g;
const LATIN = /[A-Za-zÀ-ɏ]/g;

export function wrongLanguage(lang: Lang, answer: string): boolean {
  const persian = answer.match(PERSIAN)?.length ?? 0;
  const latin = answer.match(LATIN)?.length ?? 0;
  const letters = persian + latin;
  if (letters < 40) return false;
  return lang === "fa" ? persian / letters < 0.3 : persian / letters > 0.5;
}
