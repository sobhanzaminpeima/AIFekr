/**
 * Rule-based lead score, 0-100, computed at capture time. Deliberately not an
 * AI call — it runs on every public submission, has to be instant, and the
 * signals here (did they leave a phone? a real message? which campaign?) are
 * exactly the ones a sales rep eyeballs first. Tenants can later re-weight
 * this, but a transparent rule set beats an opaque model for "why is this
 * lead a 70?".
 */
export interface LeadScoreInput {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  company?: string | null;
  message?: string | null;
  utmCampaign?: string | null;
}

export function scoreLead(input: LeadScoreInput): number {
  let score = 0;

  // Contactability is most of the value of a lead.
  if (input.phone && input.phone.trim().length >= 7) score += 35;
  if (input.email && /.+@.+\..+/.test(input.email.trim())) score += 20;

  // A real name (not "asdf", not just one letter).
  if (input.name && input.name.trim().length >= 3 && /\s|[a-zA-Z؀-ۿ]{3,}/.test(input.name.trim())) score += 10;

  // Named a company → more likely B2B / higher intent.
  if (input.company && input.company.trim().length >= 2) score += 10;

  // Wrote something specific rather than leaving it blank.
  const msg = input.message?.trim() ?? "";
  if (msg.length >= 15) score += 15;
  else if (msg.length >= 1) score += 5;

  // Came in on a tracked campaign → the tenant paid to reach them.
  if (input.utmCampaign && input.utmCampaign.trim().length > 0) score += 10;

  return Math.max(0, Math.min(100, score));
}

/** Coarse band for UI colour / filtering. */
export function scoreBand(score: number): "hot" | "warm" | "cold" {
  if (score >= 70) return "hot";
  if (score >= 40) return "warm";
  return "cold";
}
