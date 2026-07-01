import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { verifyToken } from "@/lib/auth/jwt";
import { getServerLang } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

const strings = {
  fa: {
    agents: "عوامل هوش مصنوعی",
    agent: "عامل",
    painPoints: "مشکلاتی که حل می‌کند",
    outcomes: "نتایج مورد انتظار",
    kpis: "شاخص‌های کلیدی داشبورد",
    month: "در ماه",
    activate: "فعال‌سازی بسته",
    loginToActivate: "برای فعال‌سازی وارد شوید",
    back: "← بازگشت به همه بسته‌ها",
    gold: "طلایی",
    pro: "حرفه‌ای",
    registerFirst: "ثبت‌نام و فعال‌سازی",
  },
  en: {
    agents: "AI Agents",
    agent: "agents",
    painPoints: "Problems It Solves",
    outcomes: "Expected Outcomes",
    kpis: "Dashboard KPIs",
    month: "per month",
    activate: "Activate Pack",
    loginToActivate: "Login to Activate",
    back: "← Back to All Packs",
    gold: "Gold",
    pro: "Professional",
    registerFirst: "Register & Activate",
  },
};

export default async function PackDetailPage({ params }: { params: { slug: string } }) {
  const pack = await prisma.industryPack.findUnique({ where: { slug: params.slug } });
  if (!pack) notFound();

  const lang = await getServerLang();
  const s = strings[lang];

  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  let userId: string | null = null;
  if (token) {
    const payload = verifyToken(token);
    if (payload) userId = payload.userId;
  }

  let agents: { name: string; role: string; description: string; icon: string }[] = [];
  let outcomes: { metric: string; description: string }[] = [];
  let painPoints: string[] = [];
  let kpis: string[] = [];
  let targetCustomers: string[] = [];

  try { agents = JSON.parse(pack.agents); } catch {}
  try { outcomes = JSON.parse(pack.outcomes); } catch {}
  try { painPoints = JSON.parse(pack.painPoints); } catch {}
  try { kpis = JSON.parse(pack.kpis); } catch {}
  try { targetCustomers = JSON.parse(pack.targetCustomers); } catch {}

  return (
    <div className="min-h-screen" style={{ background: "var(--surface-0)" }}>
      {/* Hero */}
      <div className="p-8 md:p-12" style={{ background: `linear-gradient(135deg, ${pack.gradientFrom}, ${pack.gradientTo})` }}>
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <span className="text-5xl">{pack.emoji}</span>
            <div>
              <h1 className="text-3xl font-bold text-white">{pack.name}</h1>
              <p className="text-white/80 mt-1">{pack.tagline}</p>
            </div>
          </div>
          <p className="text-white/90 text-lg max-w-2xl">{pack.valueProposition}</p>
          <div className="flex flex-wrap gap-2 mt-6">
            {targetCustomers.map((c) => (
              <span key={c} className="px-3 py-1 rounded-full text-sm bg-white/20 text-white">{c}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-6 md:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left */}
        <div className="lg:col-span-2 space-y-8">
          {/* Agents */}
          <div className="rounded-2xl p-6" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <h2 className="text-xl font-bold mb-5" style={{ color: "var(--text-primary)" }}>
              {s.agents} ({agents.length} {s.agent})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {agents.map((agent) => (
                <div key={agent.name} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: "var(--surface-2)" }}>
                  <span className="text-2xl flex-shrink-0">{agent.icon}</span>
                  <div>
                    <p className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>{agent.name}</p>
                    <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--text-secondary)" }}>{agent.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pain Points */}
          {painPoints.length > 0 && (
            <div className="rounded-2xl p-6" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
              <h2 className="text-xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>{s.painPoints}</h2>
              <ul className="space-y-2">
                {painPoints.map((p) => (
                  <li key={p} className="flex items-start gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                    <span className="text-red-400 mt-0.5">✕</span>{p}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Outcomes */}
          {outcomes.length > 0 && (
            <div className="rounded-2xl p-6" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
              <h2 className="text-xl font-bold mb-5" style={{ color: "var(--text-primary)" }}>{s.outcomes}</h2>
              <div className="grid grid-cols-2 gap-4">
                {outcomes.map((o) => (
                  <div key={o.metric} className="p-4 rounded-xl" style={{ background: `${pack.color}15`, border: `1px solid ${pack.color}33` }}>
                    <p className="font-bold text-lg" style={{ color: pack.color }}>{o.metric}</p>
                    <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>{o.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: pricing */}
        <div className="space-y-6">
          <div className="rounded-2xl p-6 text-center sticky top-6" style={{ background: "var(--surface-1)", border: `2px solid ${pack.color}44` }}>
            <span className="inline-block px-3 py-1 rounded-full text-xs font-medium mb-3"
              style={{
                background: pack.tier === "gold" ? "rgba(245,158,11,0.15)" : "rgba(59,130,246,0.15)",
                color: pack.tier === "gold" ? "#f59e0b" : "#3b82f6",
              }}>
              {pack.tier === "gold" ? s.gold : s.pro}
            </span>
            <div className="text-4xl font-bold mb-1" style={{ color: pack.color }}>${pack.price}</div>
            <div className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>{s.month}</div>

            {userId ? (
              <form action={`/api/packs/${pack.slug}`} method="POST">
                <button type="submit" className="w-full py-3 rounded-xl font-semibold text-white transition-all"
                  style={{ background: pack.color }}>
                  {s.activate}
                </button>
              </form>
            ) : (
              <Link href={`/register?pack=${pack.slug}`}
                className="block w-full py-3 rounded-xl font-semibold text-white text-center transition-all mb-2"
                style={{ background: pack.color }}>
                {s.registerFirst}
              </Link>
            )}
            {!userId && (
              <Link href="/login" className="block text-sm mt-2" style={{ color: "var(--text-muted)" }}>
                {s.loginToActivate}
              </Link>
            )}
          </div>

          {kpis.length > 0 && (
            <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
              <h3 className="font-semibold mb-3" style={{ color: "var(--text-primary)" }}>{s.kpis}</h3>
              <div className="space-y-2">
                {kpis.map((kpi) => (
                  <div key={kpi} className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                    <span style={{ color: pack.color }}>▪</span>{kpi}
                  </div>
                ))}
              </div>
            </div>
          )}

          <Link href="/industry" className="block text-center text-sm py-2" style={{ color: "var(--text-muted)" }}>
            {s.back}
          </Link>
        </div>
      </div>
    </div>
  );
}
