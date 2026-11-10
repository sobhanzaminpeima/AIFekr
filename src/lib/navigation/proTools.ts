import type { Lang } from "@/lib/i18n/server";
import { hasPlan, MODULE_PLANS } from "@/lib/auth/planGuard";

/**
 * The paid workspaces shown in the sidebar's "Pro tools" group. A tool the
 * account's plan includes opens directly; one it does not is still listed,
 * locked, with the plan that opens it, so people can see what an upgrade
 * gives them. The plan rules are MODULE_PLANS, the same ones the pages and
 * APIs enforce; nothing here grants access. Video Factory is sold as its own
 * packages, so it is always listed open and its page offers them.
 */
type Category = "business" | "content" | "learning";
type Tool = { key: string; module: string; href: string; icon: string; category: Category; highlight?: "popular" | "new"; label: Record<Lang, string> };

const TOOLS: Tool[] = [
  { key: "ceo", module: "ceo", href: "/ceo", icon: "Crown", category: "business", highlight: "popular", label: { fa: "مشاور مدیرعامل", en: "CEO adviser", de: "CEO-Berater", tr: "CEO danışmanı" } },
  { key: "business-doctor", module: "business-doctor", href: "/business-doctor", icon: "Stethoscope", category: "business", label: { fa: "دکتر کسب‌وکار", en: "Business doctor", de: "Business-Doktor", tr: "İş doktoru" } },
  { key: "meeting", module: "business-doctor", href: "/meeting", icon: "UsersRound", category: "business", label: { fa: "اتاق جلسهٔ هوشمند", en: "AI meeting room", de: "KI-Besprechungsraum", tr: "Yapay zekâ toplantı odası" } },
  { key: "social", module: "social", href: "/social", icon: "Instagram", category: "content", highlight: "popular", label: { fa: "استودیوی شبکه‌های اجتماعی", en: "Social studio", de: "Social-Studio", tr: "Sosyal medya stüdyosu" } },
  { key: "video-factory", module: "video-factory", href: "/video-factory", icon: "Clapperboard", category: "content", highlight: "new", label: { fa: "کارخانهٔ ویدیو", en: "Video factory", de: "Videofabrik", tr: "Video fabrikası" } },
  { key: "website-designer", module: "website-designer", href: "/website-designer", icon: "PanelsTopLeft", category: "content", label: { fa: "طراح وب‌سایت", en: "Website designer", de: "Website-Designer", tr: "Web sitesi tasarımcısı" } },
  { key: "startup", module: "startup", href: "/startup/builder", icon: "Rocket", category: "business", label: { fa: "سازندهٔ استارتاپ", en: "Startup builder", de: "Startup-Builder", tr: "Girişim oluşturucu" } },
];

export type ProTool = { key: string; href: string; icon: string; label: string; unlocked: boolean; requiredPlan: string | null; highlight: "popular" | "new" | null; recommended: boolean };

/** Which kind of work the account has been doing, from its own usage records. */
export function interestOf(usage: { type: string; metadata: string | null }[]): Record<Category, number> {
  const score: Record<Category, number> = { business: 0, content: 0, learning: 0 };
  for (const row of usage) {
    const text = (row.type + " " + (row.metadata ?? "")).toLowerCase();
    if (/crm|sales|ceo|business|meeting|accounting|lead|startup|invoice/.test(text)) score.business += 1;
    else if (/image|video|music|social|seo|website|voice|content|caption/.test(text)) score.content += 1;
    else if (/student|academy|course|flashcard|quiz|study/.test(text)) score.learning += 1;
  }
  return score;
}

export function proTools(lang: Lang, user: { plan: string; planExpiry: Date | null; role: string }, interest: Record<Category, number>): ProTool[] {
  const admin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
  const list = TOOLS.map((t) => {
    const required = MODULE_PLANS[t.module] ?? "FREE";
    const unlocked = admin || hasPlan(user, required);
    return { tool: t, unlocked, required };
  });
  // At most two locked tools are suggested: the ones closest to what the account already uses.
  const suggested = new Set(
    list.filter((x) => !x.unlocked && interest[x.tool.category] > 0)
      .sort((a, b) => interest[b.tool.category] - interest[a.tool.category])
      .slice(0, 2).map((x) => x.tool.key),
  );
  return list.map(({ tool, unlocked, required }) => ({
    key: tool.key, href: tool.href, icon: tool.icon, label: tool.label[lang],
    unlocked, requiredPlan: unlocked ? null : required,
    highlight: tool.highlight ?? null, recommended: suggested.has(tool.key),
  }));
}
