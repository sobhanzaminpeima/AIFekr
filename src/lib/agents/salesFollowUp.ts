import { prisma } from "@/lib/db/prisma";
import { routedStreamChat } from "@/lib/ai/router";
import type { Lang } from "@/lib/i18n/server";

function promptLang(l: Lang): "fa" | "en" {
  return l === "fa" ? "fa" : "en";
}

const SYSTEM = {
  fa: `تو "ایجنت فروش" هستی. یک لیست از مخاطبان CRM که نیاز به پیگیری دارند به تو داده شده، هرکدام با یک شناسه (ID).
وظیفهٔ تو: برای هرکدام یک پیام کوتاه، دوستانه و آمادهٔ ارسال (حداکثر ۲ جمله، به فارسی، مناسب ایمیل/پیامک) بنویس.
خروجی را دقیقاً به این فرمت بده — هر مخاطب یک خط، بدون هیچ توضیح یا مقدمهٔ اضافه:
ID:<شناسه دقیق> :: <متن پیام>`,
  en: `You are the "Sales Agent". You're given a list of CRM leads needing follow-up, each with an ID.
Your task: write one short, friendly, ready-to-send message per lead (max 2 sentences, in English, suitable for email/SMS).
Return output in exactly this format — one line per lead, no extra explanation or preamble:
ID:<exact id> :: <message text>`,
} as const;

export interface FollowUpDraft {
  contactId: string;
  name: string;
  email: string | null;
  phone: string | null;
  message: string;
}

/** Generates a short, ready-to-send follow-up message per CRM lead needing attention. Returned as structured data (not free-form markdown) so the UI can offer a real "send" action per contact. */
export async function generateFollowUpDrafts(userId: string, lang: Lang): Promise<FollowUpDraft[]> {
  const effectiveLang = promptLang(lang);
  const leads = await prisma.crmContact.findMany({
    where: { userId, status: { in: ["lead", "contacted"] } },
    orderBy: { updatedAt: "desc" },
    take: 10,
    select: { id: true, name: true, email: true, phone: true, status: true, company: true },
  });

  if (leads.length === 0) return [];

  const label = effectiveLang === "en" ? { name: "name", company: "company", status: "status" } : { name: "نام", company: "شرکت", status: "وضعیت" };
  const prompt = leads
    .map((l) => `ID:${l.id} — ${label.name}: ${l.name}${l.company ? `، ${label.company}: ${l.company}` : ""}، ${label.status}: ${l.status}`)
    .join("\n");

  let output = "";
  await routedStreamChat(
    [{ role: "user", content: prompt }],
    SYSTEM[effectiveLang],
    (text) => { output += text; },
    () => {},
    undefined,
    undefined,
    2048
  );

  const byId = new Map(leads.map((l) => [l.id, l]));
  const drafts: FollowUpDraft[] = [];
  for (const line of output.split("\n")) {
    const m = /^ID:(\S+)\s*::\s*(.+)/.exec(line.trim());
    if (!m) continue;
    const lead = byId.get(m[1]);
    if (!lead) continue;
    drafts.push({ contactId: lead.id, name: lead.name, email: lead.email, phone: lead.phone, message: m[2].trim() });
  }
  return drafts;
}
