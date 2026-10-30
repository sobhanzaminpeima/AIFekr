import { prisma } from "@/lib/db/prisma";
import type { Lang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n/tri";
import { loadFacts } from "./facts";
import { growthModule, moduleEntry, parseGoals, recommendModules, type Copy2, type GrowthModule } from "./modules";
import { availableModules, onboardingCopy, personalizeInvite } from "./onboarding";

/**
 * The personalized home ("workspace") for one account, from data only: its
 * saved goals, the modules an admin has switched on and this account can
 * reach, real outcomes (facts.ts) and the modules it opened recently. No
 * persona has its own hard-coded dashboard, and nothing here grants access:
 * every tool stays in the full directory.
 */
export async function homeWorkspace(
  user: { id: string; accountType: string | null },
  reach: { student: boolean; fitness: boolean },
  lang: Lang,
) {
  const pick = (c: Copy2) => (lang === "fa" ? c[0] : c[1]);
  const view = (m: GrowthModule) => ({ id: m.id, href: moduleEntry(m), name: pick(m.name), benefit: pick(m.benefit) });
  const enabled = await availableModules();
  const reachable = (m: GrowthModule) => enabled.includes(m) && (m.id !== "student" || reach.student) && (m.id !== "fitness" || reach.fitness);
  const profile = await prisma.growthProfile.findUnique({ where: { userId: user.id }, select: { goals: true, objective: true } });
  const goals = parseGoals(profile?.goals || profile?.objective);
  const tools = goals.length ? recommendModules(goals, reachable, 4) : [];
  const successes = goals.length ? (await loadFacts([user.id], 30)).get(user.id)?.successes ?? {} : {};
  // The next useful step: the first suggested tool without a real result yet; once all have one, the main tool's next step.
  const fresh = tools.find((m) => !successes[m.id]);
  const main = fresh ?? tools[0];
  const t = (fa: string, en: string, de: string, tr: string) => tri(lang, fa, en, de, tr);
  const primary = main && {
    ...view(main),
    title: pick(fresh ? main.exampleTask : main.nextStep),
    cta: fresh ? t("شروع کنید", "Get started", "Loslegen", "Başlayın") : t("ادامه دهید", "Continue", "Weitermachen", "Devam edin"),
  };
  // Modules this account opened or produced something in, latest first (module_viewed is once per session).
  const events = await prisma.growthEvent.findMany({
    where: { userId: user.id, moduleId: { not: null }, name: { in: ["module_viewed", "generation_succeeded"] } },
    orderBy: { createdAt: "desc" }, take: 40, select: { moduleId: true, createdAt: true },
  });
  const seen = new Set<string>();
  const recentModules = events.flatMap((e) => {
    const m = growthModule(e.moduleId);
    if (!m || seen.has(m.id) || !reachable(m)) return [];
    seen.add(m.id);
    return [{ ...view(m), at: e.createdAt.toISOString() }];
  }).slice(0, 3);
  const copy = onboardingCopy(lang);
  return {
    goals,
    invite: await personalizeInvite(user),
    primary: primary || null,
    tools: tools.map(view),
    recentModules,
    copy: {
      invite: copy.invite, personalize: copy.personalize,
      nextStep: t("قدم بعدی شما", "Your next step", "Ihr nächster Schritt", "Sıradaki adımınız"),
      recommended: t("پیشنهاد برای شما", "Recommended for you", "Für Sie empfohlen", "Size önerilenler"),
      recommendedHint: t("بر اساس هدف‌هایی که انتخاب کردید", "Based on the goals you picked", "Basierend auf Ihren Zielen", "Seçtiğiniz hedeflere göre"),
      allTools: t("همهٔ ابزارها", "All tools", "Alle Werkzeuge", "Tüm araçlar"),
      chat: t("گفتگو", "Chat", "Chat", "Sohbet"),
      opened: t("اخیراً باز شده", "Recently opened", "Kürzlich geöffnet", "Son açılan"),
    },
  };
}
export type HomeWorkspace = Awaited<ReturnType<typeof homeWorkspace>>;
