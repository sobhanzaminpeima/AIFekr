import { prisma } from "@/lib/db/prisma";
import { routedStreamChat } from "@/lib/ai/router";

const SYSTEM = `تو "نمایندهٔ فروش" هستی. یک لیست از مخاطبان CRM که نیاز به پیگیری دارند به تو داده شده، هرکدام با یک شناسه (ID).
وظیفهٔ تو: برای هرکدام یک پیام کوتاه، دوستانه و آمادهٔ ارسال (حداکثر ۲ جمله، به فارسی، مناسب پیامک) بنویس.
خروجی را دقیقاً به این فرمت بده — هر مخاطب یک خط، بدون هیچ توضیح یا مقدمهٔ اضافه:
ID:<شناسه دقیق> :: <متن پیام>`;

export interface FollowUpDraft {
  contactId: string;
  name: string;
  phone: string | null;
  message: string;
}

/** Generates a short, ready-to-send follow-up message per CRM lead needing attention. Returned as structured data (not free-form markdown) so the UI can offer a real "send" action per contact. */
export async function generateFollowUpDrafts(userId: string): Promise<FollowUpDraft[]> {
  const leads = await prisma.crmContact.findMany({
    where: { userId, status: { in: ["lead", "contacted"] } },
    orderBy: { updatedAt: "desc" },
    take: 10,
    select: { id: true, name: true, phone: true, status: true, company: true },
  });

  if (leads.length === 0) return [];

  const prompt = leads.map((l) => `ID:${l.id} — نام: ${l.name}${l.company ? `، شرکت: ${l.company}` : ""}، وضعیت: ${l.status}`).join("\n");

  let output = "";
  await routedStreamChat(
    [{ role: "user", content: prompt }],
    SYSTEM,
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
    drafts.push({ contactId: lead.id, name: lead.name, phone: lead.phone, message: m[2].trim() });
  }
  return drafts;
}
