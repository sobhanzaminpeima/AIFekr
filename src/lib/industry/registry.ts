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
