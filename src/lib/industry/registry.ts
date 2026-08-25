/**
 * The single point of contact between the generic Sales Agent (and, later,
 * other generic modules) and any industry-specific behavior. This is the
 * ONLY place industry code may hook into — nothing outside src/lib/industry
 * should ever branch on `industry === "..."`.
 *
 * A playbook is looked up by CrmPipeline.industrySlug (the same slug an
 * IndustryPack seeds a pipeline template with — see
 * src/lib/crm/industryTemplates.ts), never by the free-text Company.industry
 * field, which stays purely a prompt-interpolation string for the generic
 * LLM system prompt.
 *
 * Every playbook method must be defensive: return null on missing/partial
 * data rather than throwing, so a caller can always fall back to the
 * existing generic behavior with a plain `?? null` — no industry ever gets
 * special-cased into a broken state for customers using a different one.
 */

export interface SalesFollowUpContext {
  contactId: string;
  dealStage?: string | null;
}

export interface IndustrySalesPlaybook {
  slug: string;
  /**
   * Extra guidance lines to steer the LLM's follow-up message for one lead
   * (tone for the lead's current pipeline stage, similar-item suggestions,
   * etc). Returning null means "nothing special, use generic behavior."
   * Must never throw — swallow its own errors and return null instead.
   */
  buildFollowUpGuidance(userId: string, ctx: SalesFollowUpContext): Promise<string | null>;
}

const salesPlaybooks = new Map<string, IndustrySalesPlaybook>();

export function registerSalesPlaybook(playbook: IndustrySalesPlaybook) {
  salesPlaybooks.set(playbook.slug, playbook);
}

export function getSalesPlaybook(industrySlug: string | null | undefined): IndustrySalesPlaybook | null {
  if (!industrySlug) return null;
  return salesPlaybooks.get(industrySlug) || null;
}

export interface GeneratedSocialPost {
  caption: string;
  hashtags: string[];
  bestTime: string;
}

export interface IndustrySocialContentPack {
  slug: string;
  /**
   * Builds a ready-to-post Instagram caption/hashtags from a record this
   * pack owns (a real-estate Property row, keyed by id) — never invoked
   * with a generic businessName/topic, since the record itself carries
   * enough structured data (price, address, deal type, ...) to skip manual
   * prompt engineering entirely. Returns null on missing/foreign-owned
   * record or any generation failure — caller falls back to the generic
   * businessName/businessType/topic flow.
   */
  buildInstagramPost(userId: string, recordId: string, lang: "fa" | "en"): Promise<GeneratedSocialPost | null>;
}

const socialContentPacks = new Map<string, IndustrySocialContentPack>();

export function registerSocialContentPack(pack: IndustrySocialContentPack) {
  socialContentPacks.set(pack.slug, pack);
}

export function getSocialContentPack(slug: string): IndustrySocialContentPack | null {
  return socialContentPacks.get(slug) || null;
}

export type Lang = "fa" | "en" | "de";
type TriText = Record<Lang, string>;

export interface ContentIdea {
  title: TriText;
  format: TriText;
  why: TriText;
}

/** Flat, single-language shape returned to the client after localization. */
export interface LocalizedContentIdea {
  title: string;
  format: string;
  why: string;
}

/**
 * Per-industry engaging-format suggestions (item 6, batch2) — deliberately
 * framed as "proven patterns for this industry" (baseWhyPrefix below), never
 * "trending this week," since this registry has no live trend-data source.
 * A caller must show that framing honestly rather than implying real-time
 * awareness it doesn't have.
 */
const contentIdeaPacks = new Map<string, ContentIdea[]>();

export function registerContentIdeas(slug: string, ideas: ContentIdea[]) {
  contentIdeaPacks.set(slug, ideas);
}

export function localizeContentIdeas(ideas: ContentIdea[], lang: Lang): LocalizedContentIdea[] {
  return ideas.map((i) => ({ title: i.title[lang], format: i.format[lang], why: i.why[lang] }));
}

/** Generic fallback used for any industry without a dedicated pack (or no industry selected at all) — the master-prompt's own example set (UGC/unboxing etc.), industry-agnostic by design. */
const GENERIC_CONTENT_IDEAS: ContentIdea[] = [
  {
    title: { fa: "محتوای تولیدشده توسط مشتری (UGC)", en: "User-generated content (UGC)", de: "Nutzergenerierte Inhalte (UGC)" },
    format: { fa: "ریشر یا معرفی مشتریان واقعی و تجربه‌شان", en: "A reshare or feature of real customers and their experience", de: "Ein Repost oder Vorstellung echter Kunden und ihrer Erfahrung" },
    why: { fa: "اعتماد بیشتری نسبت به تبلیغ مستقیم ایجاد می‌کند", en: "Builds more trust than direct advertising", de: "Schafft mehr Vertrauen als direkte Werbung" },
  },
  {
    title: { fa: "پشت‌صحنه کسب‌وکار", en: "Behind the scenes", de: "Hinter den Kulissen" },
    format: { fa: "ویدیوی کوتاه از فرآیند کار روزمره تیم", en: "A short video of the team's everyday workflow", de: "Ein kurzes Video vom Arbeitsalltag des Teams" },
    why: { fa: "شفافیت و صمیمیت با مخاطب می‌سازد", en: "Builds transparency and closeness with the audience", de: "Schafft Transparenz und Nähe zum Publikum" },
  },
  {
    title: { fa: "سوال و جواب با مخاطبان", en: "Q&A with your audience", de: "Q&A mit deinem Publikum" },
    format: { fa: "استوری با استیکر سوال یا نظرسنجی", en: "A story with a question sticker or poll", de: "Eine Story mit Frage-Sticker oder Umfrage" },
    why: { fa: "تعامل مستقیم و داده واقعی از نیاز مخاطب می‌دهد", en: "Gives direct engagement and real data on audience needs", de: "Liefert direktes Engagement und echte Daten zu den Bedürfnissen des Publikums" },
  },
  {
    title: { fa: "قبل و بعد", en: "Before and after", de: "Vorher und nachher" },
    format: { fa: "مقایسه تصویری نتیجه کار شما", en: "A visual comparison of your work's result", de: "Ein visueller Vergleich des Ergebnisses deiner Arbeit" },
    why: { fa: "نتیجه ملموس را بهتر از هر توضیحی نشان می‌دهد", en: "Shows a tangible result better than any explanation", de: "Zeigt ein greifbares Ergebnis besser als jede Erklärung" },
  },
];

export function getContentIdeas(industrySlug: string | null | undefined): { ideas: ContentIdea[]; isGeneric: boolean } {
  const packIdeas = industrySlug ? contentIdeaPacks.get(industrySlug) : undefined;
  return packIdeas ? { ideas: packIdeas, isGeneric: false } : { ideas: GENERIC_CONTENT_IDEAS, isGeneric: true };
}
