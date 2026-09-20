import { describe, it, expect } from "vitest";
import { propertyHost, matchProperty, compareRankings, syncWindow, type RankRow } from "./rankCore";

const row = (query: string, position: number, clicks = 1, impressions = 100): RankRow => ({ query, clicks, impressions, ctr: 1, position });

describe("propertyHost", () => {
  it("reads url-prefix and domain properties, ignoring www", () => {
    expect(propertyHost("https://www.a.com/")).toBe("a.com");
    expect(propertyHost("sc-domain:A.com")).toBe("a.com");
    expect(propertyHost("not a url")).toBeNull();
  });
});

describe("matchProperty", () => {
  const props = [
    { siteUrl: "sc-domain:a.com", permissionLevel: "siteOwner" },
    { siteUrl: "http://a.com/", permissionLevel: "siteOwner" },
    { siteUrl: "https://a.com/", permissionLevel: "siteOwner" },
    { siteUrl: "https://b.com/", permissionLevel: "siteOwner" },
  ];
  it("prefers the exact-origin url-prefix property, then the domain property, then a same-host variant", () => {
    expect(matchProperty("https://a.com/", props)).toBe("https://a.com/");
    expect(matchProperty("https://a.com/", props.filter((p) => p.siteUrl !== "https://a.com/"))).toBe("sc-domain:a.com");
    expect(matchProperty("https://www.a.com/", props.filter((p) => p.siteUrl === "http://a.com/"))).toBe("http://a.com/");
  });
  it("returns null when the user does not own the site in Search Console", () => {
    expect(matchProperty("https://c.com/", props)).toBeNull();
  });
  it("ignores properties the user has not verified", () => {
    expect(matchProperty("https://a.com/", [{ siteUrl: "https://a.com/", permissionLevel: "siteUnverifiedUser" }])).toBeNull();
  });
});

describe("compareRankings", () => {
  it("reports movement in the right direction, new and dropped queries", () => {
    const prev = [row("a", 8), row("b", 3), row("gone", 12), row("same", 5)];
    const curr = [row("a", 4.5), row("b", 6), row("same", 5.2), row("fresh", 9)];
    const c = compareRankings(prev, curr);
    const by = (q: string) => c.rows.find((r) => r.query === q)!;
    expect(by("a").moved).toBe(3.5);     // 8 -> 4.5: up
    expect(by("b").moved).toBe(-3);      // 3 -> 6: down
    expect(by("same").moved).toBe(-0.2); // within noise
    expect(by("fresh")).toMatchObject({ isNew: true, moved: null });
    expect(c.gained).toBe(1);
    expect(c.lost).toBe(1);
    expect(c.newQueries).toBe(1);
    expect(c.dropped.map((r) => r.query)).toEqual(["gone"]);
  });
  it("with no previous snapshot everything is new and nothing is claimed as a gain", () => {
    const c = compareRankings([], [row("a", 3), row("b", 7)]);
    expect(c.newQueries).toBe(2);
    expect(c.gained).toBe(0);
    expect(c.lost).toBe(0);
  });
});

describe("syncWindow", () => {
  it("ends two days back and spans seven days", () => {
    expect(syncWindow(new Date("2026-03-10T12:00:00Z"))).toEqual({ start: "2026-03-02", end: "2026-03-08" });
  });
});
