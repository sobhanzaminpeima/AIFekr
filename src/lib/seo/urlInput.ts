/**
 * Turns whatever a user types into a crawlable URL. The SEO page used to demand
 * a literal "http" prefix and simply left the button disabled otherwise, so
 * typing "mysite.com" (what everyone types) did nothing and showed no reason.
 *
 * Client-safe on purpose (no Node imports): used by both the page and the API.
 * Returns null when the input cannot be a web address at all.
 */
export function normalizeUrlInput(raw: string): string | null {
  let s = (raw || "").trim();
  if (!s) return null;
  if (/\s/.test(s)) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = "https://" + s.replace(/^\/+/, "");
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  // A real host needs a dot (or be an IP); "localhost"/"abc" are not public sites.
  if (!u.hostname.includes(".") && !u.hostname.includes(":")) return null;
  return u.toString();
}
