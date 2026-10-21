/**
 * Thin wrapper around the Vapi REST API (https://docs.vapi.ai/api-reference).
 * Vapi hosts the actual phone call — telephony, speech-to-text, turn-taking,
 * text-to-speech — and calls back into our webhook for tool/function calls and
 * the end-of-call report. We never touch raw audio.
 *
 * The private API key is read from the admin-managed SiteSetting row
 * ("vapi_private_key", set from /admin/voice-agent) first, falling back to
 * the VAPI_API_KEY env var so existing env-based deployments keep working
 * without any admin action. Optional either way: every exported function
 * throws a clear, catchable error if neither is set, so the rest of the
 * module (agent CRUD, property/appointment management, dashboard) works
 * fully before a real Vapi account is connected — only "provision a phone
 * number" and "make a live call" are blocked until then.
 */

import { voiceSettings } from "./settings";

const VAPI_BASE_URL = "https://api.vapi.ai";

export class VapiNotConfiguredError extends Error {
  constructor() {
    super("کلید Vapi تنظیم نشده است — برای فعال‌سازی تماس واقعی، کلید را در پنل ادمین (ایجنت صوتی) یا متغیر محیطی VAPI_API_KEY وارد کنید.");
    this.name = "VapiNotConfiguredError";
  }
}

export class VapiRejectedError extends Error {}

async function vapiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { apiKey: key } = await voiceSettings();
  if (!key) throw new VapiNotConfiguredError();
  const res = await fetch(`${VAPI_BASE_URL}${path}`, {
    ...init,
    signal: AbortSignal.timeout(15000),
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    throw new VapiRejectedError(`Vapi request failed (${res.status}). Check provider credentials, configuration and balance.`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export interface VapiAssistantConfig {
  name: string;
  systemPrompt: string;
  voiceId?: string | null;
  /** Public webhook URL Vapi calls for tool invocations and the end-of-call report. */
  serverUrl: string;
  /** "real_estate" | "general" — which tool set to register. Defaults to "real_estate" for back-compat. */
  vertical?: string | null;
  language?: string;
  timezone?: string;
}

export interface VapiAssistant {
  id: string;
  name: string;
}

// Vapi tool declarations for the two things a real-estate agent can do
// mid-call beyond talking — look up matching listings and book a viewing.
// Vapi calls our webhook (serverUrl) synchronously with type "function-call"
// and expects a JSON `result` back; see src/app/api/webhooks/vapi/route.ts.
// Kept exactly as-is so existing real-estate users aren't broken.
const REAL_ESTATE_TOOLS = [
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
      name: "check_property_status",
      description: "بررسی وضعیت فعلی یک ملک (موجود/رزرو شده/فروخته شده) — همیشه قبل از پیشنهاد بازدید یا رزرو وقت برای یک ملک خاص این را چک کن تا به تماس‌گیرنده ملکی که دیگر موجود نیست پیشنهاد نشود.",
      parameters: {
        type: "object",
        properties: {
          propertyId: { type: "string" },
        },
        required: ["propertyId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "book_appointment",
      description: "رزرو وقت بازدید ملک برای تماس‌گیرنده پس از تعیین ملک مورد نظر و زمان دلخواه. اگر زمان درخواستی با نوبت دیگری تداخل داشته باشد، زمان‌های آزاد نزدیک پیشنهاد می‌شود.",
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

// Generic tool set for any business ("general" vertical) — no propertyId,
// just knowledge-base lookup and a bare-bones appointment/callback booking.
const GENERAL_TOOLS = [
  {
    type: "function",
    function: {
      name: "search_knowledge_base",
      description: "جستجو در دانش‌نامه کسب‌وکار برای پاسخ به سوالات تماس‌گیرنده — ساعات کاری، خدمات، قیمت‌ها، سیاست‌ها و مشابه آن.",
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
      description: "رزرو وقت یا یادداشت درخواست تماس‌گیرنده برای پیگیری توسط کسب‌وکار.",
      parameters: {
        type: "object",
        properties: {
          leadName: { type: "string" },
          leadPhone: { type: "string" },
          scheduledAtIso: { type: "string", description: "تاریخ و ساعت پیشنهادی به فرمت ISO 8601" },
          note: { type: "string", description: "توضیح کوتاه درخواست یا دلیل تماس" },
        },
        required: ["leadName", "leadPhone", "scheduledAtIso"],
      },
    },
  },
];

export function buildVoiceAgentTools(vertical?: string | null) {
  return vertical === "real_estate" ? REAL_ESTATE_TOOLS : GENERAL_TOOLS;
}

/**
 * Creates (or updates, if assistantId is given) a Vapi assistant backing one
 * VoiceAgent. Uses Vapi's native Anthropic model provider — Claude's API key
 * is configured once in the Vapi dashboard (Settings → Provider Keys), the
 * same key AIFekr's own router already uses — rather than proxying through a
 * custom OpenAI-compatible endpoint, which keeps this integration on Vapi's
 * documented, supported path instead of a hand-rolled streaming shim.
 */
export async function upsertVapiAssistant(config: VapiAssistantConfig, assistantId?: string | null): Promise<VapiAssistant> {
  const settings = await voiceSettings();
  if (!settings.webhookSecret || !settings.credentialId) throw new Error("Configure the Vapi webhook secret and credential ID before connecting a number.");
  const payload = {
    name: config.name,
    firstMessage: ({fa:"سلام، من دستیار هوش مصنوعی مجموعه هستم. چطور می‌توانم کمک کنم؟",en:"Hello, I am the AI assistant. How can I help you?",de:"Hallo, ich bin der KI-Assistent. Wie kann ich helfen?",tr:"Merhaba, yapay zekâ asistanıyım. Size nasıl yardımcı olabilirim?"} as Record<string,string>)[config.language || "fa"],
    model: {
      provider: "openai",
      model: settings.model,
      messages: [{ role: "system", content: `${config.systemPrompt}\nCurrent timezone: ${config.timezone || "Europe/Istanbul"}. Language: ${config.language || "fa"}. Always use knowledge tools for factual answers and confirm caller details before booking. Never claim a pending appointment is confirmed.` }],
      tools: buildVoiceAgentTools(config.vertical),
    },
    voice: { provider: "11labs", model: config.language === "fa" ? "eleven_v3" : "eleven_flash_v2_5", voiceId: config.voiceId || settings.voiceId },
    transcriber: { provider: "openai", model: "gpt-4o-mini-transcribe", language: config.language || "fa" },
    maxDurationSeconds: settings.maxDurationSeconds,
    serverMessages: ["tool-calls", "end-of-call-report", "status-update"],
    server: { url: config.serverUrl, credentialId: settings.credentialId },
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

/** Connect a number already imported/purchased in the administrator's Vapi account. */
export async function listPhoneNumbers(): Promise<VapiPhoneNumber[]> {
  return vapiFetch<VapiPhoneNumber[]>("/phone-number");
}
export async function connectPhoneNumber(id: string, serverUrl: string): Promise<VapiPhoneNumber> {
  const settings = await voiceSettings();
  return vapiFetch<VapiPhoneNumber>(`/phone-number/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ assistantId: null, squadId: null, server: { url: serverUrl, credentialId: settings.credentialId } }) });
}
export async function releasePhoneNumber(id: string): Promise<void> {
  // Retain the paid phone number; detach it instead of deleting it at the provider.
  await vapiFetch(`/phone-number/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ assistantId: null, squadId: null, server: null }) });
}

/** Places an outbound call from an existing agent's number to a lead's phone. */
export async function createOutboundCall(assistantId: string, phoneNumberId: string, customerNumber: string, reservationId: string): Promise<{ id: string }> {
  const settings = await voiceSettings();
  return vapiFetch<{ id: string }>("/call", {
    method: "POST",
    body: JSON.stringify({
      assistantId,
      phoneNumberId,
      metadata: { reservationId },
      assistantOverrides: { maxDurationSeconds: settings.maxDurationSeconds },
      customer: { number: customerNumber },
    }),
  });
}

export async function getVapiCall(id: string): Promise<Record<string, unknown>> { return vapiFetch(`/call/${encodeURIComponent(id)}`); }

export async function importTelnyxNumber(number:string,credentialId:string){return vapiFetch<VapiPhoneNumber>("/phone-number",{method:"POST",body:JSON.stringify({provider:"telnyx",number,credentialId,name:"AIFekr Telnyx"})});}
