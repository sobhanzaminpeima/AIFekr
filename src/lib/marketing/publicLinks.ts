import type { Metadata } from "next";
import type { Lang } from "@/lib/i18n/server";
import { prisma } from "@/lib/db/prisma";
import { parseFields, FIELD_LABELS, LEAD_FIELD_KEYS } from "@/lib/leadgen/fields";
import { toJalali } from "@/lib/utils/jalali";

/** Private share links and public forms: never indexed, and absent when the link is not valid. */
const hidden = (title: string): Metadata => ({ title: { absolute: title }, robots: { index: false, follow: false } });

export type LinkPage = {
  metadata: Metadata;
  shared?: { badge: string; title: string; subtitle: string; author: string | null; date: string; content: string };
  leadForm?: { slug: string; title: string; description: string; accent: string; logoUrl: string | null; submitLabel: string | null; successMessage: string | null; fields: { key: string; label: string; required: boolean }[] };
};

async function shared(token: string): Promise<LinkPage | null> {
  const analysis = await prisma.businessAnalysis.findUnique({ where: { shareToken: token }, select: { businessName: true, industry: true, result: true, createdAt: true, user: { select: { name: true } } } });
  if (analysis) return { metadata: hidden("AIFekr"), shared: { badge: "آنالیز کسب‌وکار", title: analysis.businessName, subtitle: analysis.industry, author: analysis.user.name, date: toJalali(analysis.createdAt), content: analysis.result } };
  const run = await prisma.contentPipelineRun.findUnique({ where: { shareToken: token }, select: { topic: true, status: true, createdAt: true, user: { select: { name: true } }, steps: { where: { agentKey: "publisher", status: "done" }, select: { output: true }, orderBy: { createdAt: "desc" }, take: 1 } } });
  if (run) return { metadata: hidden("AIFekr"), shared: { badge: "محتوای تولیدشده", title: run.topic, subtitle: run.status === "done" ? "تکمیل شده" : "در حال پردازش", author: run.user.name, date: toJalali(run.createdAt), content: run.steps[0]?.output ?? "محتوا هنوز آماده نشده است." } };
  return null;
}

async function leadForm(lang: Lang, slug: string): Promise<LinkPage | null> {
  const form = await prisma.leadForm.findUnique({ where: { slug } });
  if (!form || !form.isActive) return null;
  const config = parseFields(form.fields);
  const title = (lang === "en" ? form.titleEn : lang === "de" ? form.titleDe : null) || form.title;
  const description = (lang === "en" ? form.descriptionEn : lang === "de" ? form.descriptionDe : null) || form.description || "";
  return {
    metadata: hidden(title),
    leadForm: {
      slug: form.slug, title, description,
      accent: /^#[0-9a-fA-F]{6}$/.test(form.accentColor) ? form.accentColor : "#ea580c",
      logoUrl: form.logoUrl, submitLabel: form.submitLabel, successMessage: form.successMessage,
      fields: LEAD_FIELD_KEYS.filter((k) => config[k].show).map((k) => ({ key: k, label: FIELD_LABELS[k][lang === "tr" ? "en" : lang], required: config[k].required })),
    },
  };
}

export async function publicLink(lang: Lang, path: string): Promise<LinkPage | null> {
  const [, section, id, extra] = path.split("/");
  if (!id || extra !== undefined) return null;
  if (section === "share" && id !== "1980s") return shared(id);
  if (section === "f") return leadForm(lang, id);
  if (section === "p") return { metadata: hidden("AIFekr") };
  return null;
}
