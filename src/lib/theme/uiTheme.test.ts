import { describe, expect, it } from "vitest";
import { resolveTheme, v2Handles } from "./uiTheme";

describe("ui theme routing", () => {
  it("matches a ready route and the pages under it, never a lookalike", () => {
    const routes = ["/pricing", "/crm"];
    expect(v2Handles("/pricing", routes)).toBe(true);
    expect(v2Handles("/pricing/", routes)).toBe(true);
    expect(v2Handles("/crm/contacts?x=1", routes)).toBe(true);
    expect(v2Handles("/pricing-old", routes)).toBe(false);
    expect(v2Handles("/chat", routes)).toBe(false);
  });
  it("treats / as the landing page only", () => {
    expect(v2Handles("/", ["/"])).toBe(true);
    expect(v2Handles("/chat", ["/"])).toBe(false);
  });
  it("sends nothing to v2 while no route is ready", () => {
    expect(v2Handles("/")).toBe(false);
    expect(v2Handles("/home")).toBe(false);
  });
  it("lets a valid preview cookie override the site theme", () => {
    expect(resolveTheme("classic", "v2")).toBe("v2");
    expect(resolveTheme("v2", "classic")).toBe("classic");
    expect(resolveTheme("v2", "bogus")).toBe("v2");
    expect(resolveTheme("classic", undefined)).toBe("classic");
  });
});
