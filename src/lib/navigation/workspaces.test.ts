import { describe, expect, it } from "vitest";
import { destinations } from "./destinations";
import { OBJECTIVE_WORKSPACE, SEARCH_KEYWORDS, WORKSPACES, normalize, searchDestinations } from "./workspaces";

const routes = new Set<string>(destinations.map(d => d[0]));

describe("workspace registry", () => {
  it("only references real destinations", () => {
    for (const w of WORKSPACES) {
      expect(routes.has(w.start.href)).toBe(true);
      expect(w.tiles).toHaveLength(4);
      for (const h of w.tiles) expect(routes.has(h), `${w.id} tile: ${h}`).toBe(true);
      for (const g of w.groups) for (const h of g.hrefs) expect(routes.has(h), `${w.id}: ${h}`).toBe(true);
    }
    for (const h of Object.keys(SEARCH_KEYWORDS)) expect(routes.has(h), h).toBe(true);
  });
  it("maps every onboarding objective to a defined workspace", () => {
    for (const w of Object.values(OBJECTIVE_WORKSPACE)) expect(WORKSPACES.some(x => x.id === w)).toBe(true);
  });
  it("keeps the student workspace free of business tools", () => {
    const student = WORKSPACES.find(w => w.id === "student")!.groups.flatMap(g => g.hrefs);
    for (const h of ["/crm", "/accounting", "/sales", "/lead-gen"]) expect(student).not.toContain(h);
  });
});

describe("goal search", () => {
  const top = (q: string, lang: "fa" | "en" = "en") => searchDestinations(q, lang)[0]?.href;
  it("finds tools by what the user wants to do (en)", () => {
    expect(top("I want to make a Reel")).toMatch(/\/video-factory|\/social/);
    expect(top("create a quiz from my PDF")).toBe("/student?view=courses&tool=practice");
    expect(top("connect Instagram")).toBe("/social");
    expect(top("manage customers")).toBe("/crm");
    expect(top("create a workout plan")).toBe("/fitness");
    expect(top("generate an AI voice")).toBe("/voice-studio");
  });
  it("finds tools in Persian, including Arabic letter variants", () => {
    expect(top("میخوام ریلز بسازم", "fa")).toMatch(/\/video-factory|\/social/);
    expect(top("آزمون از جزوه", "fa")).toBe("/student?view=courses&tool=practice");
    expect(top("صداگذاری", "fa")).toBe("/voice-studio");
    expect(normalize("مشتري كيفيت")).toBe("مشتری کیفیت");
  });
  it("returns nothing for empty or noise queries", () => {
    expect(searchDestinations("", "en")).toEqual([]);
    expect(searchDestinations("zzzz qqqq", "en")).toEqual([]);
  });
});
