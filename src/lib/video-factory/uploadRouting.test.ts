import { describe, expect, it } from "vitest";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
process.env.JWT_SECRET = "isolated-routing-test-secret";
const { config } = await import("@/proxy");

describe("large manual delivery routing", () => {
  it.each(["/api/admin/video-factory/economy", "/api/admin/video-factory/gaming", "/api/admin/video-factory/gaming/"])(
    "keeps %s out of the 10 MiB proxy clone", url => {
      expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: "http://localhost" + url })).toBe(false);
    });
  it.each(["/api/payment/create", "/api/auth/login", "/api/video-factory/gaming", "/api/admin/video-factory/gaming/id/source"])(
    "preserves normal API proxy coverage for %s", url => {
      expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: "http://localhost" + url })).toBe(true);
    });
});
