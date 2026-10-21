import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { isCronAuthorized } from "./cronAuth";

const req = (url: string, headers: Record<string, string> = {}) => new NextRequest(url, { headers });
const prev = process.env.CRON_SECRET;

beforeEach(() => { process.env.CRON_SECRET = "s3cret-value"; });
afterEach(() => { if (prev === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = prev; });

describe("isCronAuthorized", () => {
  it("accepts the x-cron-secret header", () => {
    expect(isCronAuthorized(req("http://x/api/cron/a", { "x-cron-secret": "s3cret-value" }))).toBe(true);
  });
  it("accepts a Bearer token", () => {
    expect(isCronAuthorized(req("http://x/api/cron/a", { authorization: "Bearer s3cret-value" }))).toBe(true);
  });
  it("still accepts the legacy query parameter", () => {
    expect(isCronAuthorized(req("http://x/api/cron/a?secret=s3cret-value"))).toBe(true);
  });
  it("rejects a wrong or missing secret", () => {
    expect(isCronAuthorized(req("http://x/api/cron/a?secret=nope"))).toBe(false);
    expect(isCronAuthorized(req("http://x/api/cron/a", { "x-cron-secret": "s3cret-valuX" }))).toBe(false);
    expect(isCronAuthorized(req("http://x/api/cron/a"))).toBe(false);
  });
  it("refuses everything when CRON_SECRET is not configured", () => {
    delete process.env.CRON_SECRET;
    expect(isCronAuthorized(req("http://x/api/cron/a?secret=undefined"))).toBe(false);
    expect(isCronAuthorized(req("http://x/api/cron/a", { "x-cron-secret": "" }))).toBe(false);
  });
});
