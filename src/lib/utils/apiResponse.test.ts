import { describe, expect, it } from "vitest";
import { readApiResponse } from "./apiResponse";
describe("HTTP response handling", () => {
  it("does not turn a permission or network response into empty successful data", async () => {
    await expect(readApiResponse(Response.json({ error: "Access required" }, { status: 403 }), "Retry")).rejects.toThrow("Access required");
    await expect(readApiResponse(new Response("Unavailable", { status: 503 }), "Retry")).rejects.toThrow("Retry");
  });
  it("does not expose internal database errors", async () => {
    await expect(readApiResponse(Response.json({ error: "Prisma SELECT users" }, { status: 500 }), "Retry")).rejects.toThrow("Retry");
  });
  it("returns valid successful data", async () => {
    await expect(readApiResponse(Response.json({ items: [] }), "Retry")).resolves.toEqual({ items: [] });
  });
});
