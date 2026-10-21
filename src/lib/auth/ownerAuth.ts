import jwt from "jsonwebtoken";

/**
 * A property owner is not a platform User — they have no password, no
 * signup flow, and should never be able to reach a staff dashboard route.
 * So this is a completely separate, narrower token family from
 * `src/lib/auth/jwt.ts`: a distinct `kind` field so an owner link token can
 * never be replayed as a session token (or vice versa), a distinct cookie
 * name (`owner_token`, never `token`), and no role/plan fields at all —
 * an owner can only ever see the CrmContact rows that name them as
 * `ownerContactId` on a Property.
 *
 * Reuses JWT_SECRET rather than minting a second secret: the payload shapes
 * are disjoint by `kind`, so there is no cross-token confusion risk, and it
 * avoids a second required env var for a low-value-target token family.
 */
const JWT_SECRET: string = (() => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET environment variable is required and must not be empty.");
  }
  return process.env.JWT_SECRET;
})();

export const OWNER_COOKIE = "owner_token";

interface OwnerLinkPayload {
  kind: "owner_link";
  contactId: string;
}
interface OwnerSessionPayload {
  kind: "owner_session";
  contactId: string;
}

/** Emailed magic link — short-lived, single-purpose (only exchanges for a session). */
export function signOwnerLinkToken(contactId: string): string {
  return jwt.sign({ kind: "owner_link", contactId } satisfies OwnerLinkPayload, JWT_SECRET, { expiresIn: "20m" });
}

/** The cookie value after a link is exchanged — a normal long-lived session. */
export function signOwnerSessionToken(contactId: string): string {
  return jwt.sign({ kind: "owner_session", contactId } satisfies OwnerSessionPayload, JWT_SECRET, { expiresIn: "60d" });
}

export function verifyOwnerLinkToken(token: string): string | null {
  try {
    const p = jwt.verify(token, JWT_SECRET) as OwnerLinkPayload;
    return p.kind === "owner_link" ? p.contactId : null;
  } catch {
    return null;
  }
}

export function verifyOwnerSessionToken(token: string): string | null {
  try {
    const p = jwt.verify(token, JWT_SECRET) as OwnerSessionPayload;
    return p.kind === "owner_session" ? p.contactId : null;
  } catch {
    return null;
  }
}
