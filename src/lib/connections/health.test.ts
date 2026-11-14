import { describe, expect, it } from "vitest";
import { instagramHealth, searchConsoleHealth, wordpressHealth } from "./health";

const now = new Date("2026-11-11T12:00:00Z").getTime();
const at = (days: number) => new Date(now + days * 864e5);

describe("connection health", () => {
  it("flags an Instagram token before it expires and after", () => {
    expect(instagramHealth({ igUsername: "aifekr", tokenExpiry: at(30) }, now)).toMatchObject({ state: "ok", label: "@aifekr" });
    expect(instagramHealth({ igUsername: "aifekr", tokenExpiry: at(3) }, now)).toMatchObject({ state: "attention", reason: "token_expiring" });
    expect(instagramHealth({ igUsername: "aifekr", tokenExpiry: at(-1) }, now)).toMatchObject({ state: "broken", reason: "token_expired" });
    expect(instagramHealth(null, now).state).toBe("not_connected");
  });
  it("calls a Search Console link without a site incomplete, as production had", () => {
    expect(searchConsoleHealth({ siteUrl: null })).toMatchObject({ state: "attention", reason: "no_site_selected" });
    expect(searchConsoleHealth({ siteUrl: "sc-domain:aifekr.com" }).state).toBe("ok");
  });
  it("needs every WordPress field and never exposes the password", () => {
    const h = wordpressHealth({ platform: "wordpress", siteUrl: "https://x.com", wpUsername: "a", hasPassword: false });
    expect(h).toMatchObject({ state: "attention", reason: "incomplete" });
    expect(JSON.stringify(h)).not.toMatch(/password/i);
    expect(wordpressHealth({ platform: "aifekr", siteUrl: null, wpUsername: null, hasPassword: false }).state).toBe("not_connected");
  });
});
