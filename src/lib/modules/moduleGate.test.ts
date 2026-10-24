import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/modules/moduleStatus", () => ({ blockedModules: async () => ({ seo: "disabled", social: "maintenance" }) }));
import { proxy } from "@/proxy";
import { moduleKeyForPath } from "./moduleRoutes";

describe("admin module switch reaches users", () => {
  it("maps paths to registry keys without matching look-alike prefixes", () => {
    expect(moduleKeyForPath("/seo/intelligence")).toBe("seo");
    expect(moduleKeyForPath("/api/seo/analyze")).toBe("seo");
    expect(moduleKeyForPath("/seo-tips")).toBeNull();
    expect(moduleKeyForPath("/pricing")).toBeNull();
  });
  it("answers 503 for a disabled module's API and redirects its pages", async () => {
    const api = await proxy(new NextRequest("http://localhost/api/seo/analyze"));
    expect(api.status).toBe(503);
    expect((await api.json()).code).toBe("MODULE_DISABLED");
    const page = await proxy(new NextRequest("http://localhost/social"));
    expect(page.status).toBe(307);
    expect(page.headers.get("location")).toContain("/home?moduleUnavailable=social&status=maintenance");
  });
  it("never blocks admin pages or modules that are on", async () => {
    expect((await proxy(new NextRequest("http://localhost/admin/modules"))).status).not.toBe(307);
    expect((await proxy(new NextRequest("http://localhost/api/crm/contacts"))).status).not.toBe(503);
  });
});
