/**
 * A local stand-in for the Coarena Model API (test-only). Each route answers
 * from a queue of scripted responses, so a test can say "first a 429 with
 * Retry-After, then a 200" and then inspect what the adapter sent. Never
 * reaches the real service.
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

export type Scripted =
  | { status: number; json?: unknown; headers?: Record<string, string> }
  | { status: 200; sse: string[]; headers?: Record<string, string>; delayMs?: number; hang?: boolean }
  | { hang: true };

export interface Seen { method: string; path: string; auth: string | null; body: unknown }

export const MODELS_FIXTURE = {
  object: "list",
  data: [
    { id: "claude-opus-5-5", object: "model", owned_by: "anthropic", display_name: "Claude Opus 5.5", lifecycle: "active", context_length: 200000, max_completion_tokens: 32000, description: "Claude Opus 5.5 by Anthropic, through the Coarena Model API.", pricing: { prompt: "0", completion: "0" }, capabilities: { vision: true, tools: true, efforts: ["low", "high"] }, aliases: ["opus-5-5"] },
    { id: "gpt-6-luna", object: "model", owned_by: "openai", display_name: "GPT-6 Luna", lifecycle: "active", context_length: 128000, max_completion_tokens: 16384, capabilities: { vision: false, tools: true } },
    { id: "hy4", object: "model", display_name: "HY4", lifecycle: "deprecated" },
  ],
};

export const LIMITS_FIXTURE = { data: { free: true, usd_per_day: 5, requests_per_minute_account: 60, requests_per_day: null, concurrency: 4, today: { used_usd: 1.25, held_usd: 0.05, left_usd: 3.7, requests: 42, requests_left: null, resets_at: "2026-11-15T00:00:00Z", refused: { rate: 1, concurrency: 0, quota: 0 } } } };

export const USAGE_FIXTURE = { object: "usage", data: { today: { day: "2026-11-14", resets_at: 1794700800000, requests: 42, input_tokens: 12000, output_tokens: 3400, spent_usd: 1.25, held_usd: 0.05, in_flight: 1 }, totals: { requests: 300, finished: 290, errors: 10, input_tokens: 90000, output_tokens: 20000, spent_usd: 9.5, latency_p50_ms: 1800, error_rate: 0.033 }, models: [{ id: "claude-opus-5-5", name: "Claude Opus 5.5", requests: 200, input_tokens: 60000, output_tokens: 15000, spent_usd: 8, error_rate: 0.02, latency_p50_ms: 2100 }], switches: { api_on: true, models_off: [{ id: "grok-4-7", name: "Grok 4.7" }] }, keys: [{ id: "k1", prefix: "coa_live_abc", name: "server" }] } };

export async function startMockCoarena() {
  const queues = new Map<string, Scripted[]>();
  const seen: Seen[] = [];
  const open = new Set<ServerResponse>();

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const raw = Buffer.concat(chunks).toString();
    let body: unknown = null;
    try { body = raw ? JSON.parse(raw) : null; } catch { body = raw; }
    const path = (req.url ?? "").replace(/^\/api\/v1/, "");
    seen.push({ method: req.method ?? "", path, auth: req.headers.authorization ?? null, body });
    const routeKey = `${req.method} ${path.split("?")[0]}`;
    const next = queues.get(routeKey)?.shift();
    if (!next) { res.writeHead(500, { "content-type": "application/json" }); res.end(JSON.stringify({ error: { code: "no_script", message: "x", type: "server_error", param: null } })); return; }
    if ("hang" in next && next.hang && !("sse" in next)) { open.add(res); return; }
    const r = next as Exclude<Scripted, { hang: true }>;
    if ("sse" in r) {
      res.writeHead(200, { "content-type": "text/event-stream", ...(r.headers ?? {}) });
      for (const line of r.sse) {
        res.write(line);
        if (r.delayMs) await new Promise((ok) => setTimeout(ok, r.delayMs));
      }
      if (r.hang) { open.add(res); return; }
      res.end();
      return;
    }
    res.writeHead(r.status, { "content-type": "application/json", ...(r.headers ?? {}) });
    res.end(r.json === undefined ? "" : typeof r.json === "string" ? r.json : JSON.stringify(r.json));
  });
  await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
  const { port } = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${port}/api/v1`,
    seen,
    /** Queue responses for "METHOD /path". */
    script(route: string, ...responses: Scripted[]) { queues.set(route, [...(queues.get(route) ?? []), ...responses]); },
    reset() { queues.clear(); seen.length = 0; },
    async close() { for (const r of open) r.destroy(); await new Promise<void>((ok) => server.close(() => ok())); },
  };
}

export const sse = (obj: unknown) => `data: ${JSON.stringify(obj)}\n\n`;
export const delta = (text: string, id = "chatcmpl-1") => sse({ id, choices: [{ delta: { content: text } }] });
