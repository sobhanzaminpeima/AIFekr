import type { Prisma } from "@prisma/client";
import { sendEmail } from "@/lib/email/resend";
import { enqueueMobilePush } from "@/lib/mobile/push";
import { publicAppUrl } from "@/lib/utils/publicAppUrl";
import { unsubscribeToken } from "@/lib/growth/request";

export type Message = { userId: string; type: string; title: string; body: string; link: string; lang: "fa" | "en" | "de" | "tr" };

/**
 * Delivery adapters. Unlike notify(), they THROW on failure so the worker can
 * retry with backoff instead of logging a failed send as "sent". Tests inject
 * fakes; nothing here is called with a real address in tests.
 */
export type Adapters = {
  /** Writes the in-app notification inside the worker's transaction (atomic with the job update). */
  inApp(tx: Prisma.TransactionClient, m: Message, opts: { push: boolean }): Promise<{ notificationId: string }>;
  email(to: string, m: Message): Promise<void>;
  emailConfigured(): boolean;
};

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const UNSUB: Record<Message["lang"], string> = { fa: "لغو دریافت پیام‌های پیگیری", en: "Unsubscribe from follow-up messages", de: "Follow-up-Nachrichten abbestellen", tr: "Takip mesajlarından çık" };
const OPEN: Record<Message["lang"], string> = { fa: "باز کردن در AIFekr", en: "Open in AIFekr", de: "In AIFekr öffnen", tr: "AIFekr'de aç" };

/** Plain, escaped HTML with the one-click unsubscribe link every follow-up email carries. */
export function emailHtml(m: Message): string {
  const origin = publicAppUrl(), rtl = m.lang === "fa";
  const unsubscribe = `${origin}/api/growth/unsubscribe?u=${encodeURIComponent(m.userId)}&t=${unsubscribeToken(m.userId)}`;
  const link = m.link.startsWith("/") ? `${origin}${m.link}` : origin;
  return `<div dir="${rtl ? "rtl" : "ltr"}" style="font-family:Tahoma,system-ui,sans-serif;line-height:1.9;max-width:560px">`
    + `<h2 style="color:#ff6b00">${esc(m.title)}</h2><p>${esc(m.body).replace(/\n/g, "<br>")}</p>`
    + `<p><a href="${esc(link)}" style="color:#ff6b00">${OPEN[m.lang]}</a></p>`
    + `<p style="font-size:12px;color:#888"><a href="${esc(unsubscribe)}" style="color:#888">${UNSUB[m.lang]}</a></p></div>`;
}

export const realAdapters: Adapters = {
  async inApp(tx, m, opts) {
    const n = await tx.notification.create({ data: { userId: m.userId, type: m.type, title: m.title, body: m.body, link: m.link } });
    if (opts.push) await enqueueMobilePush(n, tx);
    return { notificationId: n.id };
  },
  async email(to, m) {
    if (!realAdapters.emailConfigured()) throw new Error("EMAIL_NOT_CONFIGURED");
    if (!(await sendEmail(to, m.title, emailHtml(m)))) throw new Error("EMAIL_SEND_FAILED");
  },
  // sendEmail() pretends success without a key (dev log), so the engine checks the key itself.
  emailConfigured: () => !!process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== "re_your-key-here",
};
