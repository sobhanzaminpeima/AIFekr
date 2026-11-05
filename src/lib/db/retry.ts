/**
 * Retries a database step that failed only because SQLite was busy: another
 * process held the write lock (P1008, "failed to respond in time"), an
 * interactive transaction outlived its timeout while waiting for it (P2028),
 * or a write conflict (P2034). Anything else is thrown at once. The step must
 * be safe to run again (a transaction that failed was rolled back).
 */
const BUSY = new Set(["P1008", "P2028", "P2034"]);

export function isDbBusy(error: unknown) {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" && BUSY.has(code);
}

export async function withDbRetry<T>(step: () => Promise<T>, tries = 3): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await step();
    } catch (error) {
      if (!isDbBusy(error) || attempt >= tries) throw error;
      await new Promise((r) => setTimeout(r, 400 * attempt + Math.floor(Math.random() * 300)));
    }
  }
}

/** Interactive-transaction limits for SQLite: wait longer for the write lock than the 2 s / 5 s defaults. */
export const BUSY_TX = { maxWait: 10_000, timeout: 20_000 } as const;
