import { SmsError } from "./smsirApi";

/**
 * onesms.ir "Connect API" v1.7 (https://panel.onesms.ir/documents/onesms-connect-api-v1.7.openapi.json):
 * base https://connect.onesms.ir, key in the X-API-Key header. Numbers go as 98xxxxxxxxxx.
 * Responses carry `code`; 0 is success (e.g. balance: {"balance": 2018600, "code": 0}).
 * The key is never logged.
 */
const BASE = "https://connect.onesms.ir";
export const ONESMS_BATCH_LIMIT = 100;

/** 09121234567 → 989121234567. */
export const toOnesmsNumber = (mobile: string) => (/^09\d{9}$/.test(mobile) ? "98" + mobile.slice(1) : mobile.replace(/^\+/, ""));

type Reply = { code?: number | string; message?: string; error?: string; [k: string]: unknown };

async function call(apiKey: string, path: string, body?: unknown): Promise<Reply> {
  if (!apiKey) throw new SmsError("NOT_CONFIGURED", "SMS is not configured");
  const res = await fetch(BASE + path, {
    method: body === undefined ? "GET" : "POST",
    headers: { "X-API-Key": apiKey, Accept: "application/json", ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => null)) as Reply | null;
  const code = json?.code;
  if (!res.ok || !json || (code !== undefined && Number(code) !== 0)) {
    throw new SmsError(code ?? res.status, String(json?.message ?? json?.error ?? `HTTP ${res.status}`));
  }
  return json;
}

export const onesmsBalance = async (apiKey: string) => Number((await call(apiKey, "/v1/account/balance")).balance);

/** Approved pattern (template). `data` keys are the pattern's placeholders, e.g. {"1": "4821"}. */
export const onesmsPattern = (apiKey: string, from: string, mobile: string, pattern: string, data: Record<string, string>) =>
  call(apiKey, "/v1/send/pattern", { from, to: [toOnesmsNumber(mobile)], pattern, data });

/** One text to up to 100 numbers. */
export function onesmsQuick(apiKey: string, from: string, text: string, mobiles: string[]) {
  if (mobiles.length > ONESMS_BATCH_LIMIT) throw new SmsError("TOO_MANY", "At most 100 numbers per request");
  return call(apiKey, "/v1/send/quick", { from, to: mobiles.map(toOnesmsNumber), body: text });
}
