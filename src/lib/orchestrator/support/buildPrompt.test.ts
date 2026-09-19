import { describe, it, expect } from "vitest";
import { pickNavigationTarget, buildSupportContext } from "./buildPrompt";
import { getCapability } from "../registry";
import type { KbHit } from "../kb/search";

const crm = getCapability("crm")!;
const accounting = getCapability("accounting")!;

function hit(overrides: Partial<KbHit>): KbHit {
  return { slug: "crm", title: "CRM", heading: "Where to find it", text: "CRM — Where to find it\nSidebar.", score: 0.5, href: null, capabilityKey: null, ...overrides };
}

describe("pickNavigationTarget", () => {
  it("prefers the capability behind the top KB hit over a name match", () => {
    const nav = pickNavigationTarget([hit({ capabilityKey: "crm" })], [accounting], "en", { plan: "FREE", crmPlan: "NONE" });
    expect(nav?.href).toBe("/crm");
  });

  it("falls back to a capability-name match when no hit maps to one", () => {
    const nav = pickNavigationTarget([hit({ capabilityKey: null })], [accounting], "en", { plan: "FREE", crmPlan: "NONE" });
    expect(nav?.href).toBe("/accounting");
  });

  it("returns null when nothing matched at all — there's nowhere honest to send the user", () => {
    expect(pickNavigationTarget([], [], "en", { plan: "FREE", crmPlan: "NONE" })).toBeNull();
  });

  it("flags a capability the user's plan doesn't reach, rather than asserting it does", () => {
    const nav = pickNavigationTarget([hit({ capabilityKey: "accounting" })], [], "en", { plan: "FREE", crmPlan: "NONE" });
    expect(nav?.reachable).toBe(false);
  });

  it("marks a capability the user's plan does reach", () => {
    const nav = pickNavigationTarget([hit({ capabilityKey: "accounting" })], [], "en", { plan: "FREE", crmPlan: "SOLO" });
    expect(nav?.reachable).toBe(true);
  });
});

describe("buildSupportContext", () => {
  it("tells the model honestly when nothing was retrieved, instead of an empty prompt", () => {
    expect(buildSupportContext([], [], null, "en")).toMatch(/no relevant document/i);
    expect(buildSupportContext([], [], null, "fa")).toMatch(/هیچ سند مرتبطی/);
  });

  it("includes the hit's own title+heading text verbatim, without double-wrapping a heading", () => {
    const ctx = buildSupportContext([hit({ text: "CRM — Where to find it\nSidebar → Sales." })], [], null, "en");
    expect(ctx).toContain("CRM — Where to find it\nSidebar → Sales.");
  });

  it("lists related capabilities with their real href, for the model to reference correctly", () => {
    const ctx = buildSupportContext([], [crm], null, "en");
    expect(ctx).toContain("/crm");
  });

  it("adds a plan-gate note only when the navigation target is unreachable", () => {
    const reachable = buildSupportContext([], [crm], { href: "/crm", label: "CRM", reachable: true }, "en");
    expect(reachable).not.toMatch(/not yet available/);

    const gated = buildSupportContext([], [accounting], { href: "/accounting", label: "Accounting", reachable: false }, "en");
    expect(gated).toMatch(/not yet available/);
  });
});
