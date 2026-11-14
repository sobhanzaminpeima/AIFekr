import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ setting: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { siteSetting: { findUnique: m.setting, upsert: vi.fn() } } }));
vi.mock("@/lib/crypto/secretBox", () => ({ encryptSecret: (s: string) => "enc:" + s, decryptSecret: (s: string) => s.replace(/^enc:/, "") }));
import { sendOtpSms, sendTextSms } from "./send";
import { onesmsBalance, toOnesmsNumber } from "./onesmsApi";

const KEY = "02f53c3b-06c4-4935-b50f-000000000000";
const onesms = { value: JSON.stringify({ provider: "onesms", apiKey: "enc:" + KEY, lineNumber: "9890001234", otpTemplateId: "01M75C4G6BJQGT813SWGAYX457", otpParam: "1" }) };
const fetchMock = vi.fn();
const reply = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });

beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal("fetch", fetchMock); vi.stubEnv("NODE_ENV", "production"); m.setting.mockResolvedValue(onesms); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("onesms", () => {
  it("formats Iranian numbers as 98…", () => {
    expect(toOnesmsNumber("09121234567")).toBe("989121234567");
  });

  it("sends the sign-in code through the approved pattern with the X-API-Key header", async () => {
    fetchMock.mockResolvedValue(reply({ code: 0 }));
    expect(await sendOtpSms("09121234567", "4821")).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://connect.onesms.ir/v1/send/pattern");
    expect(init.headers["X-API-Key"]).toBe(KEY);
    expect(JSON.parse(init.body)).toEqual({ from: "9890001234", to: ["989121234567"], pattern: "01M75C4G6BJQGT813SWGAYX457", data: { "1": "4821" } });
  });

  it("reports a refused send as a failure", async () => {
    fetchMock.mockResolvedValue(reply({ code: 401, message: "invalid key" }, 401));
    expect(await sendOtpSms("09121234567", "4821")).toBe(false);
  });

  it("sends texts in batches of 100 through quick send", async () => {
    fetchMock.mockResolvedValue(reply({ code: 0 }));
    const r = await sendTextSms(Array.from({ length: 150 }, (_, i) => "0912" + String(1000000 + i)), "سلام");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe("https://connect.onesms.ir/v1/send/quick");
    expect(r.sent).toBe(150);
  });

  it("reads the balance", async () => {
    fetchMock.mockResolvedValue(reply({ balance: 2018600, code: 0 }));
    expect(await onesmsBalance(KEY)).toBe(2018600);
  });
});
