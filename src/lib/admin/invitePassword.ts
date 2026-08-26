/**
 * Temporary-password format for the admin "Invite to AIfekr" tool
 * (src/app/admin/invites) — isolated here, not inlined in the UI/endpoint,
 * because the format is expected to change and every caller should update
 * automatically rather than each hardcoding its own pattern.
 *
 * Current format: AI{FirstName}!{Year} — e.g. "AISobhan!2026". Deterministic
 * by design (no random suffix) so it stays short and readable when an admin
 * types/reads it aloud. This is a one-time credential immediately forced to
 * change on first login (User.mustChangePassword) — the exposure window for
 * a same-named-user guessability concern is a single login. If that
 * trade-off ever needs tightening, add a short crypto.randomInt() suffix
 * here (see the commented example) — never Math.random() for anything
 * security-relevant.
 */

function firstName(fullName: string): string {
  const first = fullName.trim().split(/\s+/)[0] || "User";
  // Strip common punctuation/apostrophes so the password has no stray
  // symbols from the name itself, without relying on a Unicode-property
  // regex (\p{L}) that needs an ES2018+ compile target this project isn't
  // configured for.
  const cleaned = first.replace(/['".,!?()-]/g, "");
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export function generateTempPassword(fullName: string, now: Date = new Date()): string {
  const year = now.getFullYear();
  return `AI${firstName(fullName)}!${year}`;
  // If a random component becomes necessary:
  // import { randomInt } from "crypto";
  // return `AI${firstName(fullName)}!${year}${randomInt(10, 100)}`;
}
