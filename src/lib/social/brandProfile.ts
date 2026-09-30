import { prisma } from "@/lib/db/prisma";

/**
 * The tenant's Instagram positioning — who they are, who they're talking to,
 * and what they must never post.
 *
 * Before this existed the Social module asked the owner to retype their brand
 * name into an empty field on every visit, while Business Doctor had already
 * collected their description, target customers, competitors and unique value
 * into `Company` + `Company.notes`. So the first load seeds a DRAFT from that
 * existing data rather than starting blank, and every generation route reads
 * the saved profile server-side instead of trusting whatever the client sends.
 */
export interface BrandProfile {
  pageType: string | null;
  specialty: string | null;
  audience: string | null;
  tone: string | null;
  contentPillars: string[];
  avoidTopics: string | null;
  positioning: string | null;
}

export interface BrandProfileResult extends BrandProfile {
  /** True when nothing is saved yet and these values were seeded from Business Doctor. */
  isDraft: boolean;
  /** Company name/industry, for prefilling the wizard's brand fields. */
  businessName: string | null;
  businessIndustry: string | null;
}

function parsePillars(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, 5) : [];
  } catch {
    return [];
  }
}

/** Business Doctor packs its non-column answers into Company.notes as JSON. */
function parseCompanyNotes(notes: string | null | undefined): Record<string, unknown> {
  if (!notes) return {};
  try {
    const v = JSON.parse(notes);
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

export async function getBrandProfile(userId: string): Promise<BrandProfileResult> {
  const [row, company] = await Promise.all([
    prisma.socialBrandProfile.findUnique({ where: { userId } }),
    prisma.company.findUnique({ where: { userId }, select: { name: true, industry: true, notes: true } }),
  ]);

  const businessName = company?.name ?? null;
  const businessIndustry = company?.industry ?? null;

  if (row) {
    return {
      pageType: row.pageType,
      specialty: row.specialty,
      audience: row.audience,
      tone: row.tone,
      contentPillars: parsePillars(row.contentPillars),
      avoidTopics: row.avoidTopics,
      positioning: row.positioning,
      isDraft: false,
      businessName,
      businessIndustry,
    };
  }

  // Seed a draft from what Business Doctor already knows.
  const notes = parseCompanyNotes(company?.notes);
  return {
    pageType: businessIndustry,
    specialty: str(notes.products) || str(notes.description),
    audience: str(notes.targetCustomers),
    tone: null,
    contentPillars: [],
    avoidTopics: null,
    positioning: str(notes.uniqueValue) || str(notes.businessModel),
    isDraft: true,
    businessName,
    businessIndustry,
  };
}

/**
 * Renders the profile as a prompt block. Returns "" when the tenant has told
 * us nothing — callers must not fabricate a persona out of thin air.
 */
export function brandProfileToPrompt(p: BrandProfileResult | null): string {
  if (!p) return "";
  const lines: string[] = [];
  if (p.businessName) lines.push(`Business: ${p.businessName}${p.businessIndustry ? ` (${p.businessIndustry})` : ""}`);
  if (p.pageType) lines.push(`Instagram page type: ${p.pageType}`);
  if (p.specialty) lines.push(`Specialty / what they offer: ${p.specialty}`);
  if (p.audience) lines.push(`Target audience on Instagram: ${p.audience}`);
  if (p.tone) lines.push(`Brand tone of voice: ${p.tone}`);
  if (p.contentPillars.length) lines.push(`Content pillars: ${p.contentPillars.join(", ")}`);
  if (p.positioning) lines.push(`Competitive positioning: ${p.positioning}`);
  if (p.avoidTopics) lines.push(`NEVER post about / avoid: ${p.avoidTopics}`);
  if (!lines.length) return "";
  return `\n\nBrand context for this account (follow it; do not contradict it):\n${lines.join("\n")}`;
}

/** Convenience for routes: load + render in one call. */
export async function brandPromptFor(userId: string): Promise<string> {
  try {
    return brandProfileToPrompt(await getBrandProfile(userId));
  } catch {
    return "";
  }
}
