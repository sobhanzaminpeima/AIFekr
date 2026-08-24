import { prisma } from "@/lib/db/prisma";
import { routedStreamChat } from "@/lib/ai/router";
import type { Lang } from "@/lib/i18n/server";

/**
 * Section 2, item 1 — Lead Matcher. Mirrors the exact shape of
 * src/lib/agents/salesFollowUp.ts (structured drafts, never auto-sent) —
 * this is a variant of the same "propose, human sends" pattern, not new
 * infrastructure. The only addition is matching each lead against
 * Property rows (item 3's buyer-criteria matching logic, reused here)
 * before drafting, so the message can naturally mention a real listing.
 *
 * Explicit spec requirement: if the property DB is empty/unavailable, or a
 * lead has no stored search criteria, fall back to a generic follow-up
 * with no property mention — never throw.
 */

function promptLang(l: Lang): "fa" | "en" {
  return l === "fa" ? "fa" : "en";
}

interface BuyerCriteria {
  propertyType?: string;
  listingType?: string;
  city?: string;
  budgetMin?: number;
  budgetMax?: number;
  minBedrooms?: number;
}

function parseCriteria(customFields: string | null): BuyerCriteria | null {
  if (!customFields) return null;
  try {
    const parsed = JSON.parse(customFields);
    return parsed?.buyerCriteria || null;
  } catch {
    return null;
  }
}

interface MatchableProperty {
  id: string; title: string; listingType: string; propertyType: string;
  price: bigint; city: string | null; bedrooms: number | null; address: string;
}

function findMatches(properties: MatchableProperty[], criteria: BuyerCriteria): MatchableProperty[] {
  return properties.filter((p) => {
    const price = Number(p.price);
    if (criteria.propertyType && p.propertyType !== criteria.propertyType) return false;
    if (criteria.listingType && p.listingType !== criteria.listingType) return false;
    if (criteria.city && p.city !== criteria.city) return false;
    if (criteria.budgetMin != null && price < criteria.budgetMin) return false;
    if (criteria.budgetMax != null && price > criteria.budgetMax) return false;
    if (criteria.minBedrooms != null && (p.bedrooms == null || p.bedrooms < criteria.minBedrooms)) return false;
    return true;
  }).slice(0, 2);
}

const SYSTEM = {
  fa: `تو "ایجنت تطبیق لید" یک آژانس املاک هستی. یک لیست از لیدهای CRM به تو داده شده، هرکدام با یک شناسه (ID).
اگر زیر یک لید، یک یا چند ملک منطبق (با عنوان، قیمت و آدرس) آمده باشد، پیام را طوری بنویس که طبیعی به یکی/دوتای آن‌ها اشاره کند.
اگر هیچ ملکی زیر یک لید نیامده، پیام را کاملاً عمومی و دوستانه بنویس — به هیچ ملک خاصی اشاره نکن و فرض نکن نیاز او چیست.
هرگز جزئیات ملکی که در ورودی نیامده را اختراع نکن. هرگز قیمت پیشنهادی، تخفیف یا تعهد مالی/قراردادی در پیام نده.
پیام باید کوتاه (حداکثر ۲ جمله)، آماده ارسال و به فارسی باشد — این‌ها پیش‌نویس‌اند، کارشناس انسانی باید بررسی و ارسال کند.
خروجی را دقیقاً به این فرمت بده — هر لید یک خط، بدون توضیح اضافه:
ID:<شناسه دقیق> :: <متن پیام>`,
  en: `You are the "Lead Matcher" agent for a real-estate agency. You're given a list of CRM leads, each with an ID.
If one or more matching properties (title, price, address) appear under a lead, write the message to naturally reference one or two of them.
If no properties appear under a lead, write a fully generic, friendly message — do not reference any specific property or assume what they want.
Never invent property details not given in the input. Never propose a price, discount, or any financial/contractual commitment.
The message must be short (max 2 sentences), ready-to-send, in English — these are drafts a human agent must review and send.
Return output in exactly this format — one line per lead, no extra explanation:
ID:<exact id> :: <message text>`,
} as const;

export interface LeadMatchDraft {
  contactId: string;
  name: string;
  email: string | null;
  phone: string | null;
  matchedPropertyIds: string[];
  message: string;
}

export async function generateLeadMatcherDrafts(userId: string, lang: Lang): Promise<LeadMatchDraft[]> {
  const effectiveLang = promptLang(lang);

  const leads = await prisma.crmContact.findMany({
    where: { userId, status: { in: ["lead", "contacted"] } },
    orderBy: { updatedAt: "desc" },
    take: 10,
    select: { id: true, name: true, email: true, phone: true, customFields: true },
  });
  if (leads.length === 0) return [];

  // Best-effort — if the property table is empty, mid-migration, or the
  // query fails for any reason, every lead just falls back to a
  // criteria-less (generic) draft below rather than erroring the whole
  // agent out.
  let properties: MatchableProperty[] = [];
  try {
    properties = await prisma.property.findMany({
      where: { userId, status: "available" },
      select: { id: true, title: true, listingType: true, propertyType: true, price: true, city: true, bedrooms: true, address: true },
    });
  } catch (err) {
    console.error("Lead Matcher: property lookup failed, falling back to generic follow-ups:", err);
  }

  const label = effectiveLang === "en" ? { name: "name" } : { name: "نام" };
  const leadMatches = new Map<string, MatchableProperty[]>();

  const promptLines = leads.map((l) => {
    const criteria = parseCriteria(l.customFields);
    const matches = criteria && properties.length > 0 ? findMatches(properties, criteria) : [];
    leadMatches.set(l.id, matches);
    const base = `ID:${l.id} — ${label.name}: ${l.name}`;
    if (matches.length === 0) return base;
    const propLines = matches.map((p) => `  - ${p.title} — ${Number(p.price).toLocaleString()} — ${p.address}${p.city ? `, ${p.city}` : ""}`).join("\n");
    return `${base}\n${propLines}`;
  });
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
  const drafts: LeadMatchDraft[] = [];
  for (const line of output.split("\n")) {
    const m = /^ID:(\S+)\s*::\s*(.+)/.exec(line.trim());
    if (!m) continue;
    const lead = byId.get(m[1]);
    if (!lead) continue;
    drafts.push({
      contactId: lead.id, name: lead.name, email: lead.email, phone: lead.phone,
      matchedPropertyIds: (leadMatches.get(lead.id) || []).map((p) => p.id),
      message: m[2].trim(),
    });
  }
  return drafts;
}
