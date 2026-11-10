import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const m = vi.hoisted(() => ({ course: vi.fn(), materials: vi.fn(), note: vi.fn(), deleteNote: vi.fn(), stream: vi.fn(), charge: vi.fn(), credits: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { studentCourse: { findFirst: m.course }, studentMaterial: { findMany: m.materials }, studentNote: { create: m.note, deleteMany: m.deleteNote } } }));
vi.mock("@/lib/auth/middleware", () => ({ requireAuth: async () => ({ id: "user-a" }), unauthorizedResponse: () => new Response(null, { status: 401 }) }));
vi.mock("@/lib/student/access", () => ({ studentWorkspaceDisabledResponse: async () => null }));
vi.mock("@/lib/ai/router", () => ({ routedStreamChat: m.stream, getEnabledProviders: () => [] }));
vi.mock("@/lib/utils/teamCredits", () => ({ chargeAndLog: m.charge, getAvailableCredits: m.credits }));
vi.mock("@/lib/utils/rateLimit", () => ({ rateLimit: () => ({ allowed: true }) }));
vi.mock("@/lib/i18n/server", () => ({ getServerLang: async () => "fa" }));
import { POST } from "./route";

const brief = "Marketing brief for a property in North Cyprus: Meta ads, Google ads, SEO and a 90 day plan.";
const ask = (prompt: string) => POST(new NextRequest("http://localhost/api/student/assignment-assist", { method: "POST", body: JSON.stringify({ courseId: "c1", mode: "understand", prompt }) }));
const answerWith = (text: string) => m.stream.mockImplementationOnce(async (_messages: unknown, _system: unknown, onChunk: (t: string) => void) => { onChunk(text); return { id: "p", model: "m", name: "P", creditCost: 4 }; });

beforeEach(() => {
  vi.clearAllMocks();
  m.course.mockResolvedValue({ id: "c1", name: "Course" });
  m.materials.mockResolvedValue([{ title: "Brief", content: brief }]);
  m.credits.mockResolvedValue(100);
  m.note.mockResolvedValue({ id: "n1" });
  m.charge.mockResolvedValue(true);
});

describe("POST /api/student/assignment-assist", () => {
  it("reads only this user's materials for this course", async () => {
    answerWith("هوش مصنوعی شاخه‌ای از علوم کامپیوتر است.");
    await ask("هوش مصنوعی چیست؟");
    expect(m.course.mock.calls[0][0].where).toEqual({ id: "c1", userId: "user-a" });
    expect(m.materials.mock.calls[0][0].where).toEqual({ userId: "user-a", courseId: "c1" });
  });

  it("two questions back to back each carry only their own question", async () => {
    answerWith("هوش مصنوعی شاخه‌ای از علوم کامپیوتر است.");
    answerWith("فتوسنتز فرایند ساخت غذا در گیاهان است.");
    await ask("هوش مصنوعی چیست؟");
    await ask("فتوسنتز چیست؟");
    const first = m.stream.mock.calls[0][0][0].content as string, second = m.stream.mock.calls[1][0][0].content as string;
    expect(first.trim().endsWith("هوش مصنوعی چیست؟")).toBe(true);
    expect(first).not.toContain("فتوسنتز");
    expect(second.trim().endsWith("فتوسنتز چیست؟")).toBe(true);
    expect(second).not.toContain("هوش مصنوعی");
    expect(m.charge).toHaveBeenCalledTimes(2);
  });

  it("does not save or charge an answer about the uploaded material instead of the question", async () => {
    answerWith("برای فروش ملک در شمال قبرس یک برنامه ۹۰ روزه با تبلیغات Meta و Google و SEO لازم است.");
    const res = await ask("هوش مصنوعی چیست؟ در دو جمله توضیح بده.");
    expect(res.status).toBe(502);
    expect((await res.json()).code).toBe("OFF_TOPIC_ANSWER");
    expect(m.note).not.toHaveBeenCalled();
    expect(m.charge).not.toHaveBeenCalled();
  });

  it("a relevant answer is saved and charged once", async () => {
    answerWith("برای SEO این بریف، اول کلمات کلیدی را پیدا کن.");
    const res = await ask("برای SEO این بریف چه کنم؟");
    expect(res.status).toBe(200);
    expect(m.note).toHaveBeenCalledTimes(1);
    expect(m.charge).toHaveBeenCalledTimes(1);
  });
});
