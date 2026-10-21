import { randomBytes, randomInt } from "crypto";
import { findUserByReferralCode } from "@/lib/repositories/userRepository";

/**
 * Referral code generation — the single place both the public register
 * route and the admin "Invite to AIfekr" tool call, so every new code on
 * the platform is generated the same way. Existing users' codes are never
 * touched (their links are already shared/live) — this only governs
 * codes generated from here on.
 *
 * Name-based and human-readable when possible (e.g. "sobhan"), falling
 * back to a short random hex code when the name has no usable Latin
 * characters (e.g. a Persian-only name) — a fully transliterated
 * Persian-to-Latin slug isn't attempted here since a wrong/unreadable
 * transliteration would be worse than a clean random code.
 */

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip accents (é -> e, etc.)
    .replace(/[^a-z0-9]/g, "");
}

function randomCode(): string {
  return randomBytes(4).toString("hex");
}

/** Finds a free referral code, preferring a name-based slug and falling back to a short random suffix, then fully random, on collision. */
export async function generateUniqueReferralCode(name?: string | null): Promise<string> {
  const base = name ? slugify(name.trim().split(/\s+/)[0] || "") : "";

  if (base) {
    if (!(await findUserByReferralCode(base))) return base;
    // Collision: append a short random suffix a few times before giving up
    // on the name-based approach entirely.
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = `${base}${randomInt(100, 1000)}`;
      if (!(await findUserByReferralCode(candidate))) return candidate;
    }
  }

  let code = randomCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    if (!(await findUserByReferralCode(code))) break;
    code = randomCode();
  }
  return code;
}
