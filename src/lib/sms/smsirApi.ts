/**
 * sms.ir REST API v1 (https://sms.ir/rest-api/). Every response is an
 * envelope {status, message, data}; status 1 is success, 10 an invalid key,
 * 11 an inactive key. The key goes in the X-API-KEY header and is never logged.
 */
const BASE = "https://api.sms.ir/v1";
export const SMSIR_BULK_LIMIT = 100;

export class SmsError extends Error {
  constructor(public code: number | string, message: string) { super(message); this.name = "SmsError"; }
}

type Envelope<T> = { status: number; message?: string; data?: T };

async function call<T>(apiKey: string, path: string, body?: unknown): Promise<T> {
  if (!apiKey) throw new SmsError("NOT_CONFIGURED", "SMS is not configured");
  const res = await fetch(BASE + path, {
    method: body === undefined ? "GET" : "POST",
    headers: { "X-API-KEY": apiKey, Accept: "application/json", ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => null)) as Envelope<T> | null;
  if (!json) throw new SmsError(res.status, `HTTP ${res.status}`);
  if (json.status !== 1) throw new SmsError(json.status, json.message || `status ${json.status}`);
  return json.data as T;
}

export const smsirCredit = (apiKey: string) => call<number>(apiKey, "/credit");
export const smsirLines = (apiKey: string) => call<(number | string)[]>(apiKey, "/line");
export const smsirTemplates = (apiKey: string) => call<unknown>(apiKey, "/templates");

/** Template (OTP) message. A numeric template id is sent as a number, as the API documents. */
export function smsirVerify(apiKey: string, mobile: string, templateId: string, parameters: Record<string, string>) {
  return call<{ messageId: number; cost: number }>(apiKey, "/send/verify", {
    mobile,
    templateId: /^\d+$/.test(templateId) ? Number(templateId) : templateId,
    parameters: Object.entries(parameters).map(([name, value]) => ({ name, value })),
  });
}

/** One text to up to 100 numbers. */
export function smsirBulk(apiKey: string, lineNumber: string, text: string, mobiles: string[]) {
  if (mobiles.length > SMSIR_BULK_LIMIT) throw new SmsError("TOO_MANY", "At most 100 numbers per request");
  return call<{ packId: string; messageIds: (number | null)[]; cost: number }>(apiKey, "/send/bulk", { lineNumber: Number(lineNumber), messageText: text, mobiles });
}
