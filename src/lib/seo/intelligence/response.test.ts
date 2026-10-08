import { describe, it, expect } from "vitest";
import { readSeoJson } from "./response";
describe("bounded SEO provider transport", () => {
  it("reads valid structured data", async () => { expect(await readSeoJson(new Response('{"status_code":20000}'))).toEqual({ status_code: 20000 }); });
  it("rejects oversized bodies", async () => { await expect(readSeoJson(new Response("x".repeat(101)), 100)).rejects.toThrow("PROVIDER_RESPONSE_TOO_LARGE"); });
  it("rejects malformed JSON", async () => { await expect(readSeoJson(new Response("not-json"))).rejects.toThrow(); });
  it("rejects a missing body", async () => { await expect(readSeoJson(new Response(null))).rejects.toThrow("INVALID_PROVIDER_RESPONSE"); });
});
