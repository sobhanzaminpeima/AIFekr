/**
 * Which pages and API routes belong to each ModuleRegistry key, so the
 * admin "Modules" switch (status: enabled / disabled / maintenance / beta)
 * actually changes what users can reach. Client-safe: no database access
 * here -- the sidebar uses it to hide modules, the proxy to block them.
 *
 * Keys match MODULE_PLANS in src/lib/auth/planGuard.ts (the registry is
 * seeded from it). Core modules (chat, image) cannot be disabled.
 */
export const MODULE_ROUTE_PREFIXES: Record<string, string[]> = {
  chat: ["/chat", "/api/chat"],
  image: ["/image", "/api/image"],
  video: ["/video", "/api/video", "/video-factory", "/api/video-factory"],
  music: ["/music", "/api/music"],
  "voice-studio": ["/voice-studio", "/api/voice-studio"],
  crm: ["/crm", "/api/crm"],
  seo: ["/seo", "/api/seo"],
  social: ["/social", "/api/social"],
  "business-doctor": ["/business-doctor", "/api/business-doctor"],
  ceo: ["/ceo", "/api/ceo"],
  "voice-agent": ["/voice-agent", "/api/voice-agent"],
  startup: ["/startup", "/api/startup"],
  "website-designer": ["/website-designer", "/api/website-designer"],
};

/** Statuses that take a module away from users (beta stays reachable). */
export const BLOCKING_MODULE_STATUSES = ["disabled", "maintenance"] as const;

/** The registry key owning `pathname`, or null for paths no module owns. */
export function moduleKeyForPath(pathname: string): string | null {
  for (const [key, prefixes] of Object.entries(MODULE_ROUTE_PREFIXES)) {
    if (prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return key;
  }
  return null;
}
