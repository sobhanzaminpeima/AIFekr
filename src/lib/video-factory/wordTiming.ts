/**
 * Word timings for subtitles, taken from the same ElevenLabs request that makes the
 * narration (the "with-timestamps" response), so word-level sync costs nothing extra.
 */
export interface TimedWord { text: string; start: number; end: number }
export interface CharAlignment { characters?: string[]; character_start_times_seconds?: number[]; character_end_times_seconds?: number[] }

/** Groups ElevenLabs character timings into words (split on whitespace). */
export function wordsFromCharacters(alignment: CharAlignment | null | undefined): TimedWord[] {
  const chars = alignment?.characters ?? [], starts = alignment?.character_start_times_seconds ?? [], ends = alignment?.character_end_times_seconds ?? [];
  const words: TimedWord[] = [];
  let text = "", start = 0, end = 0;
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i], s = Number(starts[i]), e = Number(ends[i]);
    if (!Number.isFinite(s) || !Number.isFinite(e)) continue;
    if (/\s/.test(c)) { if (text) words.push({ text, start, end }); text = ""; continue; }
    if (!text) start = s;
    text += c; end = Math.max(end, e, s);
  }
  if (text) words.push({ text, start, end });
  return words.filter((w) => w.end >= w.start);
}

/**
 * Readable subtitle lines from timed words: at most 7 words or 42 characters per line,
 * breaking early at sentence punctuation or a pause longer than 0.35 s.
 */
export function phraseCues(words: TimedWord[], maxWords = 7, maxChars = 42): TimedWord[] {
  const out: TimedWord[] = [];
  let line: TimedWord[] = [];
  const flush = () => { if (line.length) out.push({ text: line.map((w) => w.text).join(" "), start: line[0].start, end: line[line.length - 1].end }); line = []; };
  for (let i = 0; i < words.length; i++) {
    const w = words[i], next = words[i + 1];
    line.push(w);
    const chars = line.map((x) => x.text).join(" ").length;
    const sentenceEnd = /[.!?؟…:;،,]$/.test(w.text);
    const pause = next ? next.start - w.end > 0.35 : true;
    if (line.length >= maxWords || chars >= maxChars || sentenceEnd || pause) flush();
  }
  flush();
  return out;
}
