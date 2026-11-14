/**
 * Ready-to-paste YouTube upload text (title, description with chapter
 * timestamps, hashtags and tags), built only from the project's own data, so
 * creators who upload by hand do not have to write it. No model call is made.
 */
export interface YoutubeMetaInput {
  title: string;
  brief: string;
  language: string;
  /** "m:ss Chapter title" lines, first one at 0:00. */
  chapters: string[];
  keywords?: string;
  genre?: string;
  channelName?: string;
}

const LABELS: Record<string, { title: string; description: string; chapters: string; tags: string; subscribe: string }> = {
  fa: { title: "عنوان", description: "توضیحات", chapters: "فصل‌ها", tags: "برچسب‌ها", subscribe: "برای ویدیوهای بیشتر، کانال را دنبال کنید" },
  en: { title: "TITLE", description: "DESCRIPTION", chapters: "Chapters", tags: "TAGS", subscribe: "Subscribe for more videos" },
  de: { title: "TITEL", description: "BESCHREIBUNG", chapters: "Kapitel", tags: "TAGS", subscribe: "Abonniere den Kanal für weitere Videos" },
  tr: { title: "BAŞLIK", description: "AÇIKLAMA", chapters: "Bölümler", tags: "ETİKETLER", subscribe: "Daha fazla video için kanala abone olun" },
};

/** The first one or two sentences of the brief, at most 300 characters. */
function summary(brief: string) {
  const text = brief.replace(/\s+/g, " ").trim();
  const sentences = text.match(/[^.!?؟]+[.!?؟]?/g) ?? [text];
  let out = "";
  for (const s of sentences) { if ((out + s).length > 300) break; out += s; if (out.length > 120) break; }
  return (out || text.slice(0, 300)).trim();
}

export function youtubeMetadata(input: YoutubeMetaInput) {
  const l = LABELS[input.language] ?? LABELS.en;
  const title = input.title.replace(/\s+/g, " ").trim().slice(0, 100);
  const tags = [...new Set([...(input.keywords ?? "").split(/[,،\n]/), input.genre ?? ""].map((t) => t.trim()).filter((t) => t && t.length <= 30))].slice(0, 15);
  const hashtags = tags.slice(0, 3).map((t) => "#" + t.replace(/\s+/g, "_"));
  // YouTube shows chapters only when there are at least three, starting at 0:00.
  const chapterBlock = input.chapters.length >= 3 ? `\n\n${l.chapters}:\n${input.chapters.join("\n")}` : "";
  const description = `${summary(input.brief)}${chapterBlock}\n\n${l.subscribe}${input.channelName ? ` — ${input.channelName}` : ""}${hashtags.length ? `\n\n${hashtags.join(" ")}` : ""}`.slice(0, 5000);
  return `${l.title}:\n${title}\n\n${l.description}:\n${description}\n\n${l.tags}:\n${tags.join(", ")}\n`;
}
