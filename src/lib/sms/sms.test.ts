import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ setting: vi.fn(), upsert: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { siteSetting: { findUnique: m.setting, upsert: m.upsert } } }));
vi.mock("@/lib/crypto/secretBox", () => ({ encryptSecret: (s: string) => "enc:" + s, decryptSecret: (s: string) => s.replace(/^enc:/, "") }));

import { getSmsConfig, publicSmsConfig, saveSmsConfig } from "./config";
import { sendOtpSms, sendTextSms } from "./send";
import { normalizeMobile, segmentWhere } from "./audience";

const KEY = "k".repeat(64);
const stored = (over: Record<string, unknown> = {}) => ({ value: JSON.stringify({ provider: "smsir", apiKey: "enc:" + KEY, lineNumber: "30004505000017", otpTemplateId: "123456", otpParam: "CODE", ...over }) });
const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("NODE_ENV", "production");
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

const ok = (data: unknown) => ({ ok: true, status: 200, json: async () => ({ status: 1, message: "موفق", data }) });

describe("SMS settings", () => {
  it("never shows the key to an admin, only its last four characters", async () => {
    m.setting.mockResolvedValue(stored());
    const pub = publicSmsConfig(await getSmsConfig());
    expect(JSON.stringify(pub)).not.toContain(KEY);
    expect(pub).toMatchObject({ configured: true, keyHint: "…kkkk", source: "admin" });
  });
  it("keeps the stored key when the form leaves it empty, and stores keys encrypted", async () => {
    m.setting.mockResolvedValue(stored());
    await saveSmsConfig({ provider: "smsir", apiKey: "", lineNumber: "3000", otpTemplateId: "1", otpParam: "CODE" });
    const saved = JSON.parse(m.upsert.mock.calls[0][0].update.value);
    expect(saved.apiKey).toBe("enc:" + KEY);
  });
});

describe("sign-in code", () => {
  it("goes through the approved template with the code as its parameter", async () => {
    m.setting.mockResolvedValue(stored());
    fetchMock.mockResolvedValue(ok({ messageId: 1, cost: 1 }));
    expect(await sendOtpSms("09121234567", "4821")).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.sms.ir/v1/send/verify");
    expect(init.headers["X-API-KEY"]).toBe(KEY);
    expect(JSON.parse(init.body)).toEqual({ mobile: "09121234567", templateId: 123456, parameters: [{ name: "CODE", value: "4821" }] });
  });
  it("reports failure instead of pretending, when the provider refuses the key", async () => {
    m.setting.mockResolvedValue(stored());
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ status: 10, message: "کلید وب سرویس نامعتبر است" }) });
    expect(await sendOtpSms("09121234567", "4821")).toBe(false);
  });
  it("does not claim success in production with no key", async () => {
    m.setting.mockResolvedValue(null);
    expect(await sendOtpSms("09121234567", "4821")).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("text sends", () => {
  it("splits into batches of 100 and counts what each batch accepted", async () => {
    m.setting.mockResolvedValue(stored());
    fetchMock.mockImplementation(async (_u: string, init: { body: string }) => ok({ packId: "p", messageIds: JSON.parse(init.body).mobiles.map((_: string, i: number) => (i === 0 ? null : i + 1)), cost: 2 }));
    const mobiles = Array.from({ length: 150 }, (_, i) => "0912" + String(1000000 + i));
    const r = await sendTextSms(mobiles, "سلام");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(r).toMatchObject({ sent: 148, failed: 2, cost: 4 });
  });
});

describe("audience", () => {
  it("normalizes Iranian numbers in every common form", () => {
    expect(["09121234567", "+989121234567", "989121234567", "9121234567", "۰۹۱۲۱۲۳۴۵۶۷", "0912 123 4567"].map(normalizeMobile)).toEqual(Array(6).fill("09121234567"));
    expect(normalizeMobile("12345")).toBeNull();
  });
  it("always leaves out admins, blocked users and anyone who opted out", () => {
    const w = JSON.stringify(segmentWhere({}));
    expect(w).toContain('"role":"USER"');
    expect(w).toContain('"isBlocked":false');
    expect(w).toContain('"unsubscribedAt":null');
    expect(w).toContain('"followupSuppressions":{"none":{}}');
  });
});
