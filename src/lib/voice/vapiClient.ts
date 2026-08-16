/**
 * Thin wrapper around the Vapi REST API (https://docs.vapi.ai/api-reference).
 * Vapi hosts the actual phone call — telephony, speech-to-text, turn-taking,
 * text-to-speech — and calls back into our webhook for tool/function calls and
 * the end-of-call report. We never touch raw audio.
 *
 * VAPI_API_KEY is optional at boot: every exported function throws a clear,
 * catchable error if it's unset, so the rest of the module (agent CRUD,
 * property/appointment management, dashboard) works fully before a real Vapi
 * account is connected — only "provision a phone number" and "make a live
 * call" are blocked until then.
 */

const VAPI_BASE_URL = "https://api.vapi.ai";

export class VapiNotConfiguredError extends Error {
  constructor() {
    super("VAPI_API_KEY تنظیم نشده است — برای فعال‌سازی تماس واقعی، کلید Vapi را در تنظیمات محیطی وارد کنید.");
    this.name = "VapiNotConfiguredError";
  }
}

function requireApiKey(): string {
  const key = process.env.VAPI_API_KEY;
  if (!key) throw new VapiNotConfiguredError();
  return key;
}

async function vapiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const key = requireApiKey();
  const res = await fetch(`${VAPI_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Vapi API error ${res.status}: ${body || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export interface VapiAssistantConfig {
  name: string;
  systemPrompt: string;
  voiceId?: string | null;
  /** Public webhook URL Vapi calls for tool invocations and the end-of-call report. */
  serverUrl: string;
}

export interface VapiAssistant {
  id: string;
  name: string;
}

// Vapi tool declarations for the two things the agent can do mid-call beyond
// talking — look up matching listings and book a viewing. Vapi calls our
// webhook (serverUrl) synchronously with type "function-call" and expects a
// JSON `result` back; see src/app/api/webhooks/vapi/route.ts.
const VOICE_AGENT_TOOLS = [
  {
    type: "function",
    function: {
      name: "search_properties",
      description: "جستجوی ملک‌های موجود بر اساس نوع معامله، نوع ملک، بودجه و شهر برای پیشنهاد به تماس‌گیرنده.",
      parameters: {
        type: "object",
        properties: {
          listingType: { type: "string", enum: ["buy", "sell", "rent"] },
          propertyType: { type: "string" },
          city: { type: "string" },
          maxPrice: { type: "number", description: "حداکثر بودجه به تومان" },
        },
        required: ["listingType"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_knowledge_base",
      description: "جستجو در دانش‌نامه آژانس برای پاسخ به سوالاتی که مربوط به یک ملک خاص نیست — ساعات کاری، شرایط پرداخت و رهن‌واسط، مدارک لازم، سیاست‌های شرکت و مشابه آن.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "موضوع یا سوال تماس‌گیرنده" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "book_appointment",
      description: "رزرو وقت بازدید ملک برای تماس‌گیرنده پس از تعیین ملک مورد نظر و زمان دلخواه.",
      parameters: {
        type: "object",
        properties: {
          propertyId: { type: "string" },
          leadName: { type: "string" },
          leadPhone: { type: "string" },
          scheduledAtIso: { type: "string", description: "تاریخ و ساعت پیشنهادی به فرمت ISO 8601" },
        },
        required: ["leadName", "leadPhone", "scheduledAtIso"],
      },
    },
  },
];

/**
 * Creates (or updates, if assistantId is given) a Vapi assistant backing one
 * VoiceAgent. Uses Vapi's native Anthropic model provider — Claude's API key
 * is configured once in the Vapi dashboard (Settings → Provider Keys), the
 * same key AIFekr's own router already uses — rather than proxying through a
 * custom OpenAI-compatible endpoint, which keeps this integration on Vapi's
 * documented, supported path instead of a hand-rolled streaming shim.
 */
export async function upsertVapiAssistant(config: VapiAssistantConfig, assistantId?: string | null): Promise<VapiAssistant> {
  const payload = {
    name: config.name,
    model: {
      provider: "anthropic",
      model: "claude-sonnet-5",
      messages: [{ role: "system", content: config.systemPrompt }],
      tools: VOICE_AGENT_TOOLS,
    },
    voice: config.voiceId ? { provider: "playht", voiceId: config.voiceId } : undefined,
    serverUrl: config.serverUrl,
  };

  if (assistantId) {
    return vapiFetch<VapiAssistant>(`/assistant/${assistantId}`, { method: "PATCH", body: JSON.stringify(payload) });
  }
  return vapiFetch<VapiAssistant>("/assistant", { method: "POST", body: JSON.stringify(payload) });
}

export async function deleteVapiAssistant(assistantId: string): Promise<void> {
  await vapiFetch(`/assistant/${assistantId}`, { method: "DELETE" });
}

export interface VapiPhoneNumber {
  id: string;
  number: string;
}

/** Buys a free Vapi trial number (or your imported Twilio number, depending on account setup) and binds it to the assistant. */
export async function provisionPhoneNumber(assistantId: string): Promise<VapiPhoneNumber> {
  return vapiFetch<VapiPhoneNumber>("/phone-number", {
    method: "POST",
    body: JSON.stringify({ provider: "vapi", assistantId }),
  });
}

export async function releasePhoneNumber(phoneNumberId: string): Promise<void> {
  await vapiFetch(`/phone-number/${phoneNumberId}`, { method: "DELETE" });
}

/** Places an outbound call from an existing agent's number to a lead's phone. */
export async function createOutboundCall(assistantId: string, phoneNumberId: string, customerNumber: string): Promise<{ id: string }> {
  return vapiFetch<{ id: string }>("/call", {
    method: "POST",
    body: JSON.stringify({
      assistantId,
      phoneNumberId,
      customer: { number: customerNumber },
    }),
  });
}
