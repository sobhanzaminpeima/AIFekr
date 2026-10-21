import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";

const getGscAccessToken = vi.fn();
const listGscSites = vi.fn();
const querySearchAnalytics = vi.fn();
vi.mock("@/lib/googleSearchConsole", async () => {
  class GscApiUnavailableError extends Error {}
  class GscReconnectRequiredError extends Error {}
  return {
    getGscAccessToken: (...a: unknown[]) => getGscAccessToken(...a),
    listGscSites: (...a: unknown[]) => listGscSites(...a),
    querySearchAnalytics: (...a: unknown[]) => querySearchAnalytics(...a),
    GscApiUnavailableError, GscReconnectRequiredError,
  };
});

import { GscApiUnavailableError, GscReconnectRequiredError } from "@/lib/googleSearchConsole";
import { syncRankings, getRankings } from "./rankService";

const P = `rank${Date.now().toString(36)}`;
const userId = `${P}u`;
let siteId = "";

const gscRows = (list: [string, number, number, number, number][]) => ({ rows: list.map(([q, clicks, impressions, ctr, position]) => ({ keys: [q], clicks, impressions, ctr, position })) });

beforeAll(async () => {
  process.env.JWT_SECRET ||= "test-secret";
  await prisma.user.create({ data: { id: userId, name: "u" } });
  siteId = (await prisma.seoSite.create({ data: { userId, url: "https://rank.test/" } })).id;
});
beforeEach(async () => {
  getGscAccessToken.mockReset().mockResolvedValue("token");
  listGscSites.mockReset().mockResolvedValue([{ siteUrl: "https://rank.test/", permissionLevel: "siteOwner" }]);
  querySearchAnalytics.mockReset();
  await prisma.seoRankSnapshot.deleteMany({ where: { siteId } });
  await prisma.gscConnection.deleteMany({ where: { userId } });
});
afterAll(async () => {
  await prisma.seoRankSnapshot.deleteMany({ where: { siteId } });
  await prisma.gscConnection.deleteMany({ where: { userId } });
  await prisma.seoSite.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { id: userId } });
});

const connect = () => prisma.gscConnection.create({ data: { userId, refreshToken: "plain-legacy-token" } });

describe("syncRankings", () => {
  it("stores nothing and says so when Search Console is not connected", async () => {
    expect(await syncRankings(siteId)).toEqual({ ok: false, reason: "not_connected" });
    expect(await prisma.seoRankSnapshot.count({ where: { siteId } })).toBe(0);
  });

  it("stores the real query rows (ctr as a percentage) for the matching property", async () => {
    await connect();
    querySearchAnalytics.mockResolvedValueOnce(gscRows([["berlin flat", 12, 400, 0.03, 7.4], ["rent berlin", 3, 90, 0.033, 12]]));
    const res = await syncRankings(siteId);
    expect(res).toMatchObject({ ok: true, stored: 2 });
    expect(querySearchAnalytics.mock.calls[0][1]).toBe("https://rank.test/"); // the matched property, not a guess
    const rows = await prisma.seoRankSnapshot.findMany({ where: { siteId }, orderBy: { impressions: "desc" } });
    expect(rows[0]).toMatchObject({ query: "berlin flat", clicks: 12, impressions: 400, position: 7.4 });
    expect(rows[0].ctr).toBeCloseTo(3);
  });

  it("does not use a property the user does not own for this site", async () => {
    await connect();
    listGscSites.mockResolvedValueOnce([{ siteUrl: "https://other.com/", permissionLevel: "siteOwner" }]);
    expect(await syncRankings(siteId)).toEqual({ ok: false, reason: "site_not_in_gsc" });
    expect(querySearchAnalytics).not.toHaveBeenCalled();
  });

  it("re-syncing the same window replaces the rows instead of duplicating them", async () => {
    await connect();
    querySearchAnalytics.mockResolvedValue(gscRows([["q1", 1, 10, 0.1, 5]]));
    await syncRankings(siteId);
    await syncRankings(siteId);
    expect(await prisma.seoRankSnapshot.count({ where: { siteId } })).toBe(1);
  });

  it("maps Search Console failures to a reason instead of throwing", async () => {
    await connect();
    listGscSites.mockRejectedValueOnce(new GscApiUnavailableError("403"));
    expect(await syncRankings(siteId)).toEqual({ ok: false, reason: "api_unavailable" });
    listGscSites.mockRejectedValueOnce(new GscReconnectRequiredError("expired"));
    expect(await syncRankings(siteId)).toEqual({ ok: false, reason: "reconnect_required" });
    listGscSites.mockRejectedValueOnce(new Error("boom"));
    expect(await syncRankings(siteId)).toEqual({ ok: false, reason: "error" });
  });
});

describe("getRankings", () => {
  it("is empty before the first sync", async () => {
    expect(await getRankings(siteId)).toMatchObject({ latestDate: null, comparison: null, opportunities: [] });
  });

  it("compares the newest snapshot with the one before it and finds opportunities from real rows", async () => {
    const mk = (date: string, query: string, position: number, impressions = 300) =>
      prisma.seoRankSnapshot.create({ data: { siteId, date, query, clicks: 1, impressions, ctr: 1, position } });
    await mk("2026-03-01", "berlin flat", 9);
    await mk("2026-03-01", "gone query", 4);
    await mk("2026-03-08", "berlin flat", 5);
    await mk("2026-03-08", "brand new", 15);

    const v = await getRankings(siteId);
    expect(v).toMatchObject({ latestDate: "2026-03-08", previousDate: "2026-03-01" });
    expect(v.comparison!.gained).toBe(1);
    expect(v.comparison!.newQueries).toBe(1);
    expect(v.comparison!.dropped.map((r) => r.query)).toEqual(["gone query"]);
    expect(v.opportunities.map((o) => o.query).sort()).toEqual(["berlin flat", "brand new"]); // both in striking distance (pos 4-20)
  });
});
