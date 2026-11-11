import { prisma } from "@/lib/db/prisma";

/**
 * Inbound event log (roadmap E6): every signal that reaches the platform from
 * outside, with what happened to it and how long it took. Nothing a person
 * wrote is stored; only the kind of event, the account it was for and the
 * outcome. Logging never blocks or fails the event itself.
 */
export type InboundStatus = "processed" | "failed" | "ignored" | "rejected";

export interface InboundRecord {
  source: string;
  type: string;
  accountRef?: string | null;
  status: InboundStatus;
  error?: unknown;
  latencyMs?: number | null;
}

/** A short, credential-free reason; the full error stays in the server log. */
export function eventError(error: unknown): string | null {
  if (error == null) return null;
  const text = error instanceof Error ? error.message : String(error);
  return text.replace(/access_token=[^&\s"']+/gi, "access_token=[redacted]").replace(/\s+/g, " ").trim().slice(0, 300) || null;
}

export async function recordInbound(e: InboundRecord): Promise<void> {
  try {
    await prisma.inboundEvent.create({
      data: {
        source: e.source.slice(0, 40),
        type: e.type.slice(0, 60),
        accountRef: e.accountRef ? String(e.accountRef).slice(0, 100) : null,
        status: e.status,
        error: eventError(e.error),
        latencyMs: e.latencyMs != null && Number.isFinite(e.latencyMs) ? Math.max(0, Math.round(e.latencyMs)) : null,
      },
    });
  } catch (err) {
    console.error("inbound event log failed:", err instanceof Error ? err.name : "unknown");
  }
}

/** Runs one event's handler and records its outcome and latency. Errors are recorded, then swallowed, as the webhook did before. */
export async function handleInbound(meta: { source: string; type: string; accountRef?: string | null }, work: () => Promise<void>, context: string): Promise<void> {
  const started = Date.now();
  try {
    await work();
    await recordInbound({ ...meta, status: "processed", latencyMs: Date.now() - started });
  } catch (error) {
    console.error(`${context}:`, error);
    await recordInbound({ ...meta, status: "failed", error, latencyMs: Date.now() - started });
  }
}
