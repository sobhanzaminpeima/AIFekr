export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db/prisma";
import { toJalali } from "@/lib/utils/jalali";
import Link from "next/link";

const PLAN_NAMES: Record<string, string> = { FREE: "رایگان", BASIC: "پایه", PRO: "حرفه‌ای", TEAM: "تیمی" };
const PLAN_COLORS: Record<string, string> = { FREE: "#71717a", BASIC: "#3b82f6", PRO: "#ea580c", TEAM: "#8b5cf6" };

function daysLeft(date: Date | null): number {
  if (!date) return 0;
  return Math.ceil((date.getTime() - Date.now()) / 86400000);
}

export default async function AdminSubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string }>;
}) {
  const params = await searchParams;
  const tab = params.tab || "general";
  const page = Number(params.page || 1);
  const limit = 20;

  const now = new Date();

  const [
    activeGeneral,
    expiredGeneral,
    expiringWeek,
    monthRevenue,
    generalSubs,
    industryUsers,
    totalGeneral,
    totalIndustry,
  ] = await Promise.all([
    prisma.user.count({ where: { plan: { not: "FREE" }, planExpiry: { gte: now } } }),
    prisma.user.count({ where: { plan: { not: "FREE" }, planExpiry: { lt: now } } }),
    prisma.user.count({ where: { plan: { not: "FREE" }, planExpiry: { gte: now, lte: new Date(now.getTime() + 7 * 86400000) } } }),
    prisma.payment.aggregate({ where: { status: "SUCCESS", createdAt: { gte: new Date(now.getFullYear(), now.getMonth(), 1) } }, _sum: { amount: true } }),
    tab === "general" ? prisma.user.findMany({
      where: { plan: { not: "FREE" } },
      select: { id: true, name: true, email: true, phone: true, plan: true, planExpiry: true, credits: true, createdAt: true },
      orderBy: { planExpiry: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }) : Promise.resolve([]),
    tab === "industry" ? prisma.user.findMany({
      where: { industryPackId: { not: null } },
      select: { id: true, name: true, email: true, phone: true, industryPackId: true, industryPack: { select: { name: true, color: true, emoji: true } }, createdAt: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }) : Promise.resolve([]),
    prisma.user.count({ where: { plan: { not: "FREE" } } }),
    prisma.user.count({ where: { industryPackId: { not: null } } }),
  ]);

  const totalPages = Math.ceil((tab === "general" ? totalGeneral : totalIndustry) / limit);
  const revenue = monthRevenue._sum.amount || 0;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>مدیریت اشتراک‌ها</h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>مدیریت پلن‌های عمومی و بسته‌های صنعتی</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "اشتراک فعال (عمومی)", value: activeGeneral.toLocaleString("fa-IR"), color: "#10b981" },
          { label: "منقضی‌شده", value: expiredGeneral.toLocaleString("fa-IR"), color: "#ef4444" },
          { label: "منقضی این هفته", value: expiringWeek.toLocaleString("fa-IR"), color: "#f59e0b" },
          { label: "درآمد این ماه", value: (revenue / 10).toLocaleString("fa-IR") + " ت", color: "#ea580c" },
        ].map(s => (
          <div key={s.label} className="p-4 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <div className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>{s.label}</div>
            <div className="text-xl font-bold" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2">
        {[
          { key: "general", label: `پلن عمومی (${totalGeneral})` },
          { key: "industry", label: `بسته صنعتی (${totalIndustry})` },
        ].map(t => (
          <Link key={t.key} href={`?tab=${t.key}&page=1`}
            className="px-4 py-2 rounded-xl text-sm font-medium"
            style={{ background: tab === t.key ? "var(--primary)" : "var(--surface-1)", color: tab === t.key ? "white" : "var(--text-secondary)", border: "1px solid var(--border)" }}>
            {t.label}
          </Link>
        ))}
      </div>

      {/* General subscriptions */}
      {tab === "general" && (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--surface-1)", borderBottom: "1px solid var(--border)" }}>
                {["کاربر", "پلن", "انقضا", "روز مانده", "اعتبار"].map(h => (
                  <th key={h} className="px-4 py-3 text-right font-medium" style={{ color: "var(--text-muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {generalSubs.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-12 text-center" style={{ color: "var(--text-muted)" }}>اشتراکی یافت نشد</td></tr>
              )}
              {generalSubs.map((u, i) => {
                const days = daysLeft(u.planExpiry);
                const isExpired = days <= 0;
                const isExpiring = days > 0 && days <= 7;
                return (
                  <tr key={u.id} style={{ borderBottom: i < generalSubs.length - 1 ? "1px solid var(--border)" : undefined, background: i % 2 === 0 ? "var(--surface-0)" : "var(--surface-1)" }}>
                    <td className="px-4 py-3">
                      <div style={{ color: "var(--text-primary)" }}>{u.name || "—"}</div>
                      <div className="text-xs" style={{ color: "var(--text-muted)" }}>{u.email || u.phone}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ background: `${PLAN_COLORS[u.plan] || "#71717a"}20`, color: PLAN_COLORS[u.plan] || "#71717a" }}>
                        {PLAN_NAMES[u.plan] || u.plan}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>
                      {u.planExpiry ? toJalali(u.planExpiry) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ background: isExpired ? "rgba(239,68,68,0.1)" : isExpiring ? "rgba(245,158,11,0.1)" : "rgba(16,185,129,0.1)", color: isExpired ? "#ef4444" : isExpiring ? "#f59e0b" : "#10b981" }}>
                        {isExpired ? "منقضی" : `${days} روز`}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                      {u.credits.toLocaleString("fa-IR")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Industry pack subscriptions */}
      {tab === "industry" && (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--surface-1)", borderBottom: "1px solid var(--border)" }}>
                {["کاربر", "بسته صنعتی", "تاریخ ثبت‌نام"].map(h => (
                  <th key={h} className="px-4 py-3 text-right font-medium" style={{ color: "var(--text-muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {industryUsers.length === 0 && (
                <tr><td colSpan={3} className="px-4 py-12 text-center" style={{ color: "var(--text-muted)" }}>کاربری با بسته صنعتی یافت نشد</td></tr>
              )}
              {industryUsers.map((u: any, i: number) => (
                <tr key={u.id} style={{ borderBottom: i < industryUsers.length - 1 ? "1px solid var(--border)" : undefined, background: i % 2 === 0 ? "var(--surface-0)" : "var(--surface-1)" }}>
                  <td className="px-4 py-3">
                    <div style={{ color: "var(--text-primary)" }}>{u.name || "—"}</div>
                    <div className="text-xs" style={{ color: "var(--text-muted)" }}>{u.email || u.phone}</div>
                  </td>
                  <td className="px-4 py-3">
                    {u.industryPack && (
                      <span className="flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full w-fit"
                        style={{ background: `${u.industryPack.color}20`, color: u.industryPack.color }}>
                        {u.industryPack.emoji} {u.industryPack.name}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>
                    {toJalali(u.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map(p => (
            <Link key={p} href={`?tab=${tab}&page=${p}`}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-sm"
              style={{ background: p === page ? "var(--primary)" : "var(--surface-1)", color: p === page ? "white" : "var(--text-secondary)" }}>
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}