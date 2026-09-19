import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Guard against a new AI route shipping free. Any API route that calls a model
 * (router, provider SDK or an agent) must charge credits, or be listed below
 * with the reason it is legitimately unbilled. Adding a route to that list is
 * a deliberate, reviewable act -- forgetting to charge is not.
 */
const API_ROOT = path.join(process.cwd(), "src/app/api");

const CALLS_MODEL = /routedStreamChat|routedChat|@\/lib\/ai\/(router|claude|qwen|replicate|fal|openaiImage|elevenlabs|typesafe)|@\/lib\/agents\//;
const CHARGES = /withToolCredits|reserveToolCredits|chargeAndLog|deductCredits/;

/** route dir (relative to src/app/api) -> why it is not charged per call */
const UNBILLED: Record<string, string> = {
  "support/chat": "support bot: rate-limited by design, never deducts credits (product decision)",
  "chat": "billed after the answer via chargeAndLog (dynamic per-model cost)",
  "webhooks/vapi": "inbound provider webhook, no user session; voice billed from call reports",
  "webhooks/replicate": "inbound provider webhook",
  "public/leadform/[slug]": "public lead form; abuse-limited, no user wallet",
  "public/property-lead": "public lead form; abuse-limited, no user wallet",
  "cron/lead-followup-sequence": "cron; drafts only, human approves before anything is sent",
  "cron/viewing-followup": "cron; drafts only, human approves before anything is sent",
  "admin/llm/config": "admin-only provider configuration",
  "admin/llm/test": "admin-only provider test",
  "admin/media-providers": "admin-only",
  "admin/system": "admin-only",
  "ai/chat-providers": "read-only provider list",
  "ai/image-providers": "read-only provider list",
  "ai/video-providers": "read-only provider list",
  "video/status": "status poll of an already-charged job",
  "music/status": "status poll of an already-charged job",
  "accounting/ai/anomalies": "rule-based, no model call",
  "accounting/ai/proposals/[id]": "approve/reject a stored proposal: ledger write, no model call",
  "ceo/orchestrator/snapshot": "data snapshot, no model call",
  "crm/viewings": "slot suggestion is rule-based, no model call",
  "crm/viewings/needs-feedback": "query only, no model call",
  "seo/agent-pipeline/audit": "deterministic content audit, no model call",
  "social/content-ideas": "cached 24h per profile; pack ideas are free",
};

function routes(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) routes(p, out);
    else if (e.name === "route.ts") out.push(p);
  }
  return out;
}

describe("AI routes are billed", () => {
  it("every route that calls a model charges credits or is explicitly allow-listed", () => {
    const uncovered: string[] = [];
    for (const file of routes(API_ROOT)) {
      const src = fs.readFileSync(file, "utf8");
      if (!CALLS_MODEL.test(src) || CHARGES.test(src)) continue;
      const rel = path.relative(API_ROOT, path.dirname(file)).split(path.sep).join("/");
      if (!(rel in UNBILLED)) uncovered.push(rel);
    }
    expect(uncovered).toEqual([]);
  });

  it("does not keep allow-list entries for routes that no longer exist", () => {
    const existing = new Set(routes(API_ROOT).map((f) => path.relative(API_ROOT, path.dirname(f)).split(path.sep).join("/")));
    expect(Object.keys(UNBILLED).filter((k) => !existing.has(k))).toEqual([]);
  });
});
