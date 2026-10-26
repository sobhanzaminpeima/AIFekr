import { it, expect } from "vitest";
import { boundedJson } from "./request";
it("rejects oversized bodies even without a content-length header", async () => { const req = new Request("https://example.com", { method: "POST", body: '{"text":"' + "a".repeat(100) + '"}' }); await expect(boundedJson(req, 50)).rejects.toMatchObject({ status: 413 }); });
it("rejects malformed JSON without echoing submitted content", async () => { await expect(boundedJson(new Request("https://example.com", { method: "POST", body: "private invalid content" }))).rejects.toThrow("INVALID_INPUT"); });
