import { describe, expect, it } from "vitest";
import { pageLang, resolveTheme, v2Handles } from "./uiTheme";

describe("ui theme routing", () => {
  it("matches a ready route and the pages under it, never a lookalike", () => {
    const routes = ["/pricing", "/guides"];
    expect(v2Handles("/pricing", routes)).toBe(true);
    expect(v2Handles("/pricing/", routes)).toBe(true);
    expect(v2Handles("/guides/contacts?x=1", routes)).toBe(true);
    expect(v2Handles("/pricing-old", routes)).toBe(false);
    expect(v2Handles("/chat", routes)).toBe(false);
  });
  it("treats / as the landing page only", () => {
    expect(v2Handles("/", ["/"])).toBe(true);
    expect(v2Handles("/chat", ["/"])).toBe(false);
  });
  it("sends only the rebuilt pages to v2", () => {
    for (const path of ["/", "/pricing", "/about", "/contact", "/guides", "/guides/x", "/features/crm", "/solutions/business", "/login", "/register", "/home", "/chat", "/chat/abc", "/create", "/gallery", "/image/gallery", "/image/generate", "/video/generate", "/music/generate", "/voice-studio", "/video-factory", "/crm", "/welcome", "/privacy", "/terms", "/security"]) expect(v2Handles(path)).toBe(true);
    for (const path of ["/chatbot", "/privacy/x", "/industry", "/admin", "/pricing-old", "/login-old", "/welcome/setup", "/home/x", "/image/generate/x", "/create/image", "/gallery/x", "/voice-studio/x", "/video-factory/x", "/crm/x"]) expect(v2Handles(path)).toBe(false);
  });
  it("decides a page language like getServerLang: a valid lang cookie first", async () => {
    expect(await pageLang("de")).toBe("de");
    expect(await pageLang("tr")).toBe("tr");
  });
  it("lets a valid preview cookie override the site theme", () => {
    expect(resolveTheme("classic", "v2")).toBe("v2");
    expect(resolveTheme("v2", "classic")).toBe("classic");
    expect(resolveTheme("v2", "bogus")).toBe("v2");
    expect(resolveTheme("classic", undefined)).toBe("classic");
  });
});
