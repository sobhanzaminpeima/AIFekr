import { randomUUID } from "crypto";

interface LinkInput { label?: string; url?: string }

/** Accepts up to 2 {label, url} pairs from the client and assigns each a stable id used by the click-tracking redirect route. */
export function normalizeLinks(raw: unknown): string | null {
  if (!Array.isArray(raw)) return null;
  const links = (raw as LinkInput[])
    .filter((l) => l?.label?.trim() && l?.url?.trim())
    .slice(0, 2)
    .map((l) => ({ id: randomUUID(), label: l.label!.trim(), url: l.url!.trim(), clicks: 0 }));
  return links.length > 0 ? JSON.stringify(links) : null;
}
