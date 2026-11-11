import { describe, expect, it } from "vitest";
import { classifyOwnership, workspaceSlotTaken, type OtherConnection } from "./ownership";

const now = new Date("2026-11-10T12:00:00Z");
const future = new Date("2026-12-01T00:00:00Z");
const past = new Date("2026-11-01T00:00:00Z");
const row = (over: Partial<OtherConnection>): OtherConnection => ({ id: "c1", userId: "someone", businessId: null, tokenExpiry: future, ...over });

describe("classifyOwnership", () => {
  it("is free when nobody else holds the account (reconnecting your own is idempotent)", () => {
    expect(classifyOwnership([], "me", now)).toEqual({ kind: "free" });
  });
  it("reports a live link on another platform account as a conflict", () => {
    expect(classifyOwnership([row({})], "me", now)).toEqual({ kind: "other_account" });
  });
  it("reports your own other workspace separately", () => {
    expect(classifyOwnership([row({ userId: "me", businessId: "b2" })], "me", now)).toEqual({ kind: "other_workspace" });
  });
  it("another account outranks your own workspace", () => {
    expect(classifyOwnership([row({ userId: "me", businessId: "b2" }), row({ id: "c2" })], "me", now)).toEqual({ kind: "other_account" });
  });
  it("lets a verified owner reclaim only when every other token is expired", () => {
    expect(classifyOwnership([row({ tokenExpiry: past }), row({ id: "c2", tokenExpiry: past })], "me", now)).toEqual({ kind: "stale", connectionIds: ["c1", "c2"] });
    expect(classifyOwnership([row({ tokenExpiry: past }), row({ id: "c2" })], "me", now)).toEqual({ kind: "other_account" });
  });
  it("treats an unknown expiry as live", () => {
    expect(classifyOwnership([row({ tokenExpiry: null })], "me", now)).toEqual({ kind: "other_account" });
  });
});

describe("one Instagram account per workspace", () => {
  it("refuses a different account instead of replacing the connected one", () => {
    expect(workspaceSlotTaken({ igUserId: "personal" }, "brand")).toBe(true);
  });
  it("lets the same account reconnect and an empty workspace connect", () => {
    expect(workspaceSlotTaken({ igUserId: "brand" }, "brand")).toBe(false);
    expect(workspaceSlotTaken(null, "brand")).toBe(false);
  });
});
