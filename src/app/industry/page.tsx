import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { getServerLang } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

const strings = {
  fa: {
    title: "بازار بسته‌های صنعتی",
    subtitle: "تیم‌های عامل هوش مصنوعی ویژه برای هر صنعت — آماده برای کار ۲۴/۷",
    empty: "بسته‌ای یافت نشد",
    emptySub: "لطفاً با ادمین تماس بگیرید",
    agents: "عامل AI",
    month: "ماه",
    view: "مشاهده بسته",
    gold: "طلایی",
    pro: "حرفه‌ای",
  },
  en: {
    title: "Industry AI Packs Marketplace",
    subtitle: "Specialized AI agent teams for every industry — ready to work 24/7",
    empty: "No packs found",
    emptySub: "Please contact admin",
    agents: "AI agents",
    month: "mo",
    view: "View Pack",
    gold: "Gold",
    pro: "Professional",
  },
};

interface Pack {
  id: string; slug: string; name: string; emoji: string; tagline: string;
  agents: string; tier: string; price: number; color: string;
  gradientFrom: string; gradientTo: string;
}

export default async function IndustryPage() {
  const lang = await getServerLang();
  const s = strings[lang];

  let packs: Pack[] = [];
  try {
    packs = await prisma.industryPack.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });
  } catch {}

  return (
    <div className="min-h-screen p-8" style={{ background: "var(--surface-0)" }}>
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-3" style={{ color: "var(--text-primary)" }}>{s.title}</h1>
          <p className="text-lg max-w-2xl mx-auto" style={{ color: "var(--text-secondary)" }}>{s.subtitle}</p>
        </div>

        {packs.length === 0 && (
          <div className="text-center py-20 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <p className="text-lg" style={{ color: "var(--text-secondary)" }}>{s.empty}</p>
            <p className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>{s.emptySub}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {packs.map((pack) => {
            let agentCount = 0;
            try { agentCount = JSON.parse(pack.agents).length; } catch {}

            return (
              <div key={pack.id} className="rounded-2xl overflow-hidden flex flex-col transition-all hover:scale-105 hover:shadow-xl"
                style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
                <div className="p-5 flex items-center gap-3"
                  style={{ background: `linear-gradient(135deg, ${pack.gradientFrom}, ${pack.gradientTo})` }}>
                  <span className="text-3xl">{pack.emoji}</span>
                  <div>
                    <h3 className="font-bold text-white">{pack.name}</h3>
                    <p className="text-xs text-white/70">{pack.tagline}</p>
                  </div>
                </div>

                <div className="p-4 flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs px-2 py-1 rounded-full font-medium"
                      style={{
                        background: pack.tier === "gold" ? "rgba(245,158,11,0.15)" : "rgba(59,130,246,0.15)",
                        color: pack.tier === "gold" ? "#f59e0b" : "#3b82f6",
                      }}>
                      {pack.tier === "gold" ? s.gold : s.pro}
                    </span>
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>{agentCount} {s.agents}</span>
                  </div>

                  <div className="flex-1" />

                  <div className="flex items-center justify-between mt-4">
                    <span className="font-bold" style={{ color: pack.color }}>
                      ${pack.price}<span className="text-xs font-normal" style={{ color: "var(--text-muted)" }}>/{s.month}</span>
                    </span>
                    <Link href={`/industry/${pack.slug}`}
                      className="px-4 py-1.5 rounded-lg text-xs font-medium text-white transition-all"
                      style={{ background: pack.color }}>
                      {s.view}
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
