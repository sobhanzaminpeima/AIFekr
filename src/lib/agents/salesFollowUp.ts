import { prisma } from "@/lib/db/prisma";
import { routedStreamChat } from "@/lib/ai/router";
import { getSalesPlaybook } from "@/lib/industry";
import type { Lang } from "@/lib/i18n/server";

function promptLang(l: Lang): "fa" | "en" {
  return l === "fa" ? "fa" : "en";
}

const SYSTEM = {
  fa: `تو "ایجنت فروش" هستی. یک لیست از مخاطبان CRM که نیاز به پیگیری دارند به تو داده شده، هرکدام با یک شناسه (ID).
اگر زیر یک مخاطب خط راهنمای اضافه (indent شده) آمده، آن را حتماً در لحن/محتوای پیام همان مخاطب اعمال کن.
وظیفهٔ تو: برای هرکدام یک پیام کوتاه، دوستانه و آمادهٔ ارسال (حداکثر ۲ جمله، به فارسی، مناسب ایمیل/پیامک) بنویس.
هرگز عدد قیمت، تخفیف، یا هر تعهد مالی/قراردادی در پیام پیشنهاد نده — این پیام‌ها پیش‌نویس‌اند و باید توسط کارشناس انسانی بررسی و ارسال شوند.
خروجی را دقیقاً به این فرمت بده — هر مخاطب یک خط، بدون هیچ توضیح یا مقدمهٔ اضافه:
ID:<شناسه دقیق> :: <متن پیام>`,
  en: `You are the "Sales Agent". You're given a list of CRM leads needing follow-up, each with an ID.
If an indented guidance line appears under a lead, apply it to that lead's tone/content.
Your task: write one short, friendly, ready-to-send message per lead (max 2 sentences, in English, suitable for email/SMS).
Never propose a price, discount, or any financial/contractual commitment in the message — these are drafts a human agent must review and send.
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
    select: {
      id: true, name: true, email: true, phone: true, status: true, company: true,
      deals: {
        where: { status: "open" },
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: { stage: { select: { name: true } }, pipeline: { select: { industrySlug: true } } },
      },
    },
  });

  if (leads.length === 0) return [];

  const label = effectiveLang === "en" ? { name: "name", company: "company", status: "status" } : { name: "نام", company: "شرکت", status: "وضعیت" };

  // Industry playbook hook — only ever adds extra guidance lines for a lead
  // whose open deal sits on an industry-tagged pipeline (e.g. real-estate);
  // every other lead/business is completely unaffected. Any playbook error
  // is already swallowed inside buildFollowUpGuidance and yields null here.
  const promptLines = await Promise.all(
    leads.map(async (l) => {
      const base = `ID:${l.id} — ${label.name}: ${l.name}${l.company ? `، ${label.company}: ${l.company}` : ""}، ${label.status}: ${l.status}`;
      const deal = l.deals[0];
      const playbook = getSalesPlaybook(deal?.pipeline.industrySlug);
      if (!playbook) return base;
      const guidance = await playbook.buildFollowUpGuidance(userId, { contactId: l.id, dealStage: deal?.stage.name });
      return guidance ? `${base}\n  ${guidance.split("\n").join("\n  ")}` : base;
    })
  );
  const prompt = promptLines.join("\n");

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
