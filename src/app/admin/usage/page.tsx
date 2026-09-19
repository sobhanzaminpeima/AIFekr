"use client";

import { useState, useEffect, useCallback } from "react";
import { TOOL_COST_LABELS } from "@/lib/utils/credits";
import { AlertTriangle, RefreshCw, Coins, Activity, Users, Calculator, ShieldAlert, Save, CheckCircle2 } from "lucide-react";

interface EconomicsStats {
  days: number;
  totalCostUsd: number;
  revenueUsd: number;
  grossMarginPct: number | null;
  usdToToman: number;
  byProvider: { provider: string; costUsd: number; calls: number }[];
  redFlagUsers: { userId: string; costUsd: number; user: { id: string; name: string | null; email: string | null; plan: string } | null }[];
}

interface UsageStats {
  days: number;
  totalCalls: number;
  totalTokens: number;
  missingTokenCount: number;
  distinctUsers: number;
  byType: { type: string; calls: number; tokens: number; credits: number }[];
  byModel: { model: string; calls: number; tokens: number }[];
  dailySeries: { day: string; calls: number; tokens: number }[];
  planLimits: Record<string, { dailyChats: number; monthlyImages: number; monthlyVideos: number; monthlyMusics: number; initialCredits: number }>;
  creditCosts: Record<string, number>;
}

const CREDIT_COST_LABELS: Record<string, string> = {
  chat: "چت (هر پیام)",
  image_standard: "تصویر — استاندارد",
  image_hd: "تصویر — HD",
  video_5s: "ویدیو — تا ۵ ثانیه",
  video_10s: "ویدیو — تا ۱۰ ثانیه",
  video_30s: "ویدیو — تا ۳۰ ثانیه",
  music_30s: "موزیک — تا ۳۰ ثانیه",
  music_60s: "موزیک — تا ۶۰ ثانیه",
  music_120s: "موزیک — تا ۱۲۰ ثانیه",
  tool: "ابزار عمومی",
};

const PLAN_LABELS: Record<string, string> = { FREE: "رایگان", BASIC: "پایه", PRO: "حرفه‌ای", TEAM: "تیمی" };

export default function AdminUsagePage() {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [economics, setEconomics] = useState<EconomicsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [error, setError] = useState<string | null>(null);

  // Cost calculator inputs — defaults are a generic "nano-tier" price point;
  // editable so any provider's real pricing can be plugged in.
  // Revenue Simulator (Phase 5) — a forward-looking "what if we had N paying
  // users at $X revenue and $Y AI cost each" projection, seeded from the
  // real current numbers once they load so it starts from reality rather
  // than an arbitrary guess. Purely client-side arithmetic; nothing here
  // reads or writes any backend state.
  const [simUsers, setSimUsers] = useState(100);
  const [simRevenuePerUser, setSimRevenuePerUser] = useState(20);
  const [simCostPerUser, setSimCostPerUser] = useState(2);
  const [simSeeded, setSimSeeded] = useState(false);

  const [inputPrice, setInputPrice] = useState(0.2); // $ per 1M input tokens
  const [cachedPrice, setCachedPrice] = useState(0.02); // $ per 1M cached input tokens
  const [outputPrice, setOutputPrice] = useState(1.25); // $ per 1M output tokens
  const [outputShare, setOutputShare] = useState(30); // % of tokens assumed to be output
  const [cachedShare, setCachedShare] = useState(0); // % of input tokens assumed cached

  // editable plan-limit form state, kept separate from `stats.planLimits`
  // so in-progress edits aren't clobbered by a background refresh
  const [limitsDraft, setLimitsDraft] = useState<UsageStats["planLimits"] | null>(null);
  const [savingLimits, setSavingLimits] = useState(false);
  const [savedLimits, setSavedLimits] = useState(false);
  const [limitsError, setLimitsError] = useState<string | null>(null);

  // Phase 5 "Credit Rules" -- same pattern as the plan-limits editor above,
  // backed by the SiteSetting getCreditCosts() reads (see creditCosts.ts).
  const [costsDraft, setCostsDraft] = useState<UsageStats["creditCosts"] | null>(null);
  const [savingCosts, setSavingCosts] = useState(false);
  const [savedCosts, setSavedCosts] = useState(false);
  const [costsError, setCostsError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, econRes] = await Promise.all([
        fetch(`/api/admin/usage?days=${days}`, { credentials: "include" }),
        fetch(`/api/admin/economics?days=${days}`, { credentials: "include" }),
      ]);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setStats(data);
      setLimitsDraft((prev) => prev ?? data.planLimits);
      setCostsDraft((prev) => prev ?? data.creditCosts);
      if (econRes.ok) setEconomics(await econRes.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (simSeeded || !economics || !stats || stats.distinctUsers === 0) return;
    setSimUsers(stats.distinctUsers);
    setSimRevenuePerUser(Math.round((economics.revenueUsd / stats.distinctUsers) * 100) / 100 || 20);
    setSimCostPerUser(Math.round((economics.totalCostUsd / stats.distinctUsers) * 100) / 100 || 2);
    setSimSeeded(true);
  }, [economics, stats, simSeeded]);

  const updateDraft = (plan: string, field: string, value: number) => {
    setLimitsDraft((prev) => (prev ? { ...prev, [plan]: { ...prev[plan as keyof typeof prev], [field]: value } } : prev));
    setSavedLimits(false);
  };

  const saveLimits = async () => {
    if (!limitsDraft) return;
    setSavingLimits(true);
    setLimitsError(null);
    setSavedLimits(false);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: { planLimits: JSON.stringify(limitsDraft) } }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSavedLimits(true);
      setStats((prev) => (prev ? { ...prev, planLimits: limitsDraft } : prev));
    } catch (e) {
      setLimitsError(e instanceof Error ? e.message : "ذخیره ناموفق بود");
    } finally {
      setSavingLimits(false);
    }
  };

  const updateCostDraft = (key: string, value: number) => {
    setCostsDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSavedCosts(false);
  };

  const saveCosts = async () => {
    if (!costsDraft) return;
    setSavingCosts(true);
    setCostsError(null);
    setSavedCosts(false);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: { creditCosts: JSON.stringify(costsDraft) } }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSavedCosts(true);
      setStats((prev) => (prev ? { ...prev, creditCosts: costsDraft } : prev));
    } catch (e) {
      setCostsError(e instanceof Error ? e.message : "ذخیره ناموفق بود");
    } finally {
      setSavingCosts(false);
    }
  };

  const tokens = stats?.totalTokens ?? 0;
  const outputTokens = tokens * (outputShare / 100);
  const inputTokensTotal = tokens - outputTokens;
  const cachedTokens = inputTokensTotal * (cachedShare / 100);
  const freshInputTokens = inputTokensTotal - cachedTokens;

  const estCost =
    (freshInputTokens / 1_000_000) * inputPrice +
    (cachedTokens / 1_000_000) * cachedPrice +
    (outputTokens / 1_000_000) * outputPrice;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <Coins className="w-5 h-5" style={{ color: "#ea580c" }} />
            مصرف و هزینهٔ هوش مصنوعی
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
            آمار واقعی مصرف از UsageLog + محاسبه‌گر هزینه بر اساس نرخ هر مدل
          </p>
        </div>
        <div className="flex items-center gap-2">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{ background: days === d ? "var(--primary)" : "var(--surface-2)", color: days === d ? "white" : "var(--text-secondary)" }}
            >
              {d} روز
            </button>
          ))}
          <button onClick={load} disabled={loading} className="p-2 rounded-lg transition-all disabled:opacity-50" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 rounded-xl" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}>
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {economics && (
        <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid var(--border)" }}>
            <Calculator className="w-4 h-4" style={{ color: "#ea580c" }} />
            <h2 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>اکونومیک واحد (Unit Economics)</h2>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>— هزینهٔ واقعی AI (از AiModelPricing) در برابر درآمد واقعی (از پرداخت‌های موفق)</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4">
            <div>
              <div className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>هزینهٔ AI ({economics.days} روز)</div>
              <div className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>${economics.totalCostUsd.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>درآمد پرداخت‌های موفق</div>
              <div className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>${economics.revenueUsd.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>حاشیهٔ ناخالص</div>
              <div className="text-lg font-bold" style={{ color: economics.grossMarginPct == null ? "var(--text-muted)" : economics.grossMarginPct < 0 ? "#ef4444" : "#16a34a" }}>
                {economics.grossMarginPct == null ? "—" : `${economics.grossMarginPct.toFixed(1)}٪`}
              </div>
            </div>
            <div>
              <div className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>نرخ تبدیل</div>
              <div className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{Math.round(economics.usdToToman).toLocaleString("fa-IR")} ت</div>
            </div>
          </div>
          {economics.byProvider.length > 0 && (
            <div className="px-4 pb-4">
              <div className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>هزینه به تفکیک ارائه‌دهنده</div>
              <div className="space-y-1.5">
                {economics.byProvider.map((p) => (
                  <div key={p.provider} className="flex items-center justify-between text-xs">
                    <span style={{ color: "var(--text-secondary)" }}>{p.provider}</span>
                    <span style={{ color: "var(--text-muted)" }}>{p.calls}× · ${p.costUsd.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {economics.redFlagUsers.length > 0 && (
            <div className="px-4 pb-4">
              <div className="flex items-center gap-1.5 mb-2">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs font-medium text-amber-400">
                  کاربران پرهزینه ({economics.redFlagUsers.length}) — هزینهٔ AI بیش از ${5} در این بازه
                </span>
              </div>
              <div className="space-y-1.5">
                {economics.redFlagUsers.map((r) => (
                  <div key={r.userId} className="flex items-center justify-between text-xs">
                    <span style={{ color: "var(--text-secondary)" }}>{r.user?.name || r.user?.email || r.userId} · {r.user?.plan ?? "?"}</span>
                    <span className="font-medium text-amber-400">${r.costUsd.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Revenue Simulator */}
          <div className="px-4 pb-4 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
            <div className="flex items-center gap-1.5 mb-3">
              <Calculator className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
              <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>شبیه‌ساز درآمد (Revenue Simulator)</span>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <label className="text-xs" style={{ color: "var(--text-muted)" }}>
                تعداد کاربر
                <input type="number" min={0} value={simUsers} onChange={(e) => setSimUsers(Number(e.target.value))}
                  className="w-full mt-1 px-2 py-1.5 rounded-lg text-xs" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
              </label>
              <label className="text-xs" style={{ color: "var(--text-muted)" }}>
                درآمد هر کاربر ($)
                <input type="number" min={0} step={0.01} value={simRevenuePerUser} onChange={(e) => setSimRevenuePerUser(Number(e.target.value))}
                  className="w-full mt-1 px-2 py-1.5 rounded-lg text-xs" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
              </label>
              <label className="text-xs" style={{ color: "var(--text-muted)" }}>
                هزینهٔ AI هر کاربر ($)
                <input type="number" min={0} step={0.01} value={simCostPerUser} onChange={(e) => setSimCostPerUser(Number(e.target.value))}
                  className="w-full mt-1 px-2 py-1.5 rounded-lg text-xs" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
              </label>
            </div>
            {(() => {
              const projRevenue = simUsers * simRevenuePerUser;
              const projCost = simUsers * simCostPerUser;
              const projMargin = projRevenue > 0 ? ((projRevenue - projCost) / projRevenue) * 100 : null;
              return (
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div><span style={{ color: "var(--text-muted)" }}>درآمد ماهانه: </span><span className="font-bold" style={{ color: "var(--text-primary)" }}>${projRevenue.toLocaleString()}</span></div>
                  <div><span style={{ color: "var(--text-muted)" }}>هزینهٔ AI ماهانه: </span><span className="font-bold" style={{ color: "var(--text-primary)" }}>${projCost.toLocaleString()}</span></div>
                  <div><span style={{ color: "var(--text-muted)" }}>حاشیهٔ ناخالص: </span><span className="font-bold" style={{ color: projMargin == null ? "var(--text-muted)" : projMargin < 0 ? "#ef4444" : "#16a34a" }}>{projMargin == null ? "—" : `${projMargin.toFixed(1)}٪`}</span></div>
                </div>
              );
            })()}
            <p className="text-[11px] mt-2" style={{ color: "var(--text-muted)" }}>
              مقادیر اولیه از میانگین واقعی {stats?.distinctUsers ?? 0} کاربر فعال این بازه محاسبه شده — برای شبیه‌سازی سناریوهای رشد، اعداد رو دستی تغییر بدید.
            </p>
          </div>
        </div>
      )}

      {stats && (
        <>
          {stats.missingTokenCount > 0 && (
            <div className="flex items-start gap-2 p-4 rounded-xl" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)" }}>
              <ShieldAlert className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                <b className="text-amber-400">{stats.missingTokenCount}</b> از {stats.totalCalls} درخواست در این بازه توکن ثبت‌شده ندارن (رکوردهای قدیمی، قبل از فعال‌سازی ثبت توکن واقعی، یا providerهایی که usage برنمی‌گردونن). عدد توکن زیر فقط شامل درخواست‌هایی‌ه که مقدار واقعی گزارش شده — پس یه کف مصرف واقعیه، نه سقفش.
              </p>
            </div>
          )}

          {/* summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2 mb-1"><Activity className="w-4 h-4" style={{ color: "#ea580c" }} /><span className="text-xs" style={{ color: "var(--text-muted)" }}>کل درخواست‌ها</span></div>
              <div className="text-3xl font-bold" style={{ color: "#ea580c" }}>{stats.totalCalls.toLocaleString()}</div>
              <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{days} روز اخیر</div>
            </div>
            <div className="p-4 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2 mb-1"><Coins className="w-4 h-4" style={{ color: "#8b5cf6" }} /><span className="text-xs" style={{ color: "var(--text-muted)" }}>کل توکن ثبت‌شده</span></div>
              <div className="text-3xl font-bold" style={{ color: "#8b5cf6" }}>{tokens.toLocaleString()}</div>
              <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>فقط رکوردهای دارای usage واقعی</div>
            </div>
            <div className="p-4 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2 mb-1"><Users className="w-4 h-4" style={{ color: "#22c55e" }} /><span className="text-xs" style={{ color: "var(--text-muted)" }}>کاربران فعال</span></div>
              <div className="text-3xl font-bold" style={{ color: "#22c55e" }}>{stats.distinctUsers}</div>
              <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>حداقل ۱ درخواست</div>
            </div>
            <div className="p-4 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2 mb-1"><Calculator className="w-4 h-4" style={{ color: "#fbbf24" }} /><span className="text-xs" style={{ color: "var(--text-muted)" }}>هزینهٔ تخمینی</span></div>
              <div className="text-3xl font-bold" style={{ color: "#fbbf24" }}>${estCost.toFixed(2)}</div>
              <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>بر اساس نرخ‌های پایین</div>
            </div>
          </div>

          {/* cost calculator */}
          <div className="p-5 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <h3 className="font-semibold text-sm mb-4 flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
              <Calculator className="w-4 h-4" style={{ color: "var(--primary)" }} />
              محاسبه‌گر هزینه (نرخ‌ها رو با قیمت مدل واقعی خودتون جایگزین کنید)
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { label: "ورودی ($/1M توکن)", value: inputPrice, set: setInputPrice, step: 0.01 },
                { label: "ورودی کش‌شده ($/1M)", value: cachedPrice, set: setCachedPrice, step: 0.01 },
                { label: "خروجی ($/1M توکن)", value: outputPrice, set: setOutputPrice, step: 0.01 },
                { label: "سهم خروجی از کل (%)", value: outputShare, set: setOutputShare, step: 1 },
                { label: "سهم کش از ورودی (%)", value: cachedShare, set: setCachedShare, step: 1 },
              ].map((f) => (
                <div key={f.label}>
                  <label className="text-xs block mb-1" style={{ color: "var(--text-muted)" }}>{f.label}</label>
                  <input
                    type="number"
                    step={f.step}
                    value={f.value}
                    onChange={(e) => f.set(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                  />
                </div>
              ))}
            </div>
            <p className="text-xs mt-3" style={{ color: "var(--text-muted)" }}>
              پیش‌فرض‌ها فقط نمونه‌ان. برای اهرم واقعی صرفه‌جویی: پرامپت‌های سیستمی ثابت (BASE_SYSTEM هر عامل) رو کش کنید — این می‌تونه هزینهٔ همون بخش از ورودی رو تا ۱۰ برابر کاهش بده.
            </p>
          </div>

          {/* by type / by model */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
              <h3 className="font-semibold text-sm mb-4" style={{ color: "var(--text-primary)" }}>مصرف به تفکیک نوع</h3>
              {stats.byType.length === 0 ? (
                <p className="text-xs text-center py-6" style={{ color: "var(--text-muted)" }}>داده‌ای نیست</p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      <th className="text-right pb-2" style={{ color: "var(--text-muted)" }}>نوع</th>
                      <th className="text-right pb-2" style={{ color: "var(--text-muted)" }}>تعداد</th>
                      <th className="text-right pb-2" style={{ color: "var(--text-muted)" }}>توکن</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.byType.map((r) => (
                      <tr key={r.type} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td className="py-2" style={{ color: "var(--text-primary)" }}>{r.type}</td>
                        <td className="py-2" style={{ color: "var(--text-secondary)" }}>{r.calls}</td>
                        <td className="py-2" style={{ color: "var(--text-secondary)" }}>{r.tokens.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="p-5 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
              <h3 className="font-semibold text-sm mb-4" style={{ color: "var(--text-primary)" }}>مصرف به تفکیک مدل</h3>
              {stats.byModel.length === 0 ? (
                <p className="text-xs text-center py-6" style={{ color: "var(--text-muted)" }}>داده‌ای نیست</p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      <th className="text-right pb-2" style={{ color: "var(--text-muted)" }}>مدل</th>
                      <th className="text-right pb-2" style={{ color: "var(--text-muted)" }}>تعداد</th>
                      <th className="text-right pb-2" style={{ color: "var(--text-muted)" }}>توکن</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.byModel.map((r) => (
                      <tr key={r.model} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td className="py-2" style={{ color: "var(--text-primary)" }}>{r.model}</td>
                        <td className="py-2" style={{ color: "var(--text-secondary)" }}>{r.calls}</td>
                        <td className="py-2" style={{ color: "var(--text-secondary)" }}>{r.tokens.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Credit Rules — per-feature credit cost, editable, persisted to SiteSetting (key "creditCosts"), no deploy needed. Read by every charge route via getCreditCosts(). */}
          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            <div className="px-4 py-3 flex items-center justify-between gap-2" style={{ background: "var(--surface-1)", borderBottom: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>قوانین کردیت (Credit Rules) — هزینهٔ هر عملیات، قابل‌ویرایش، بدون نیاز به دیپلوی</span>
              </div>
              <button
                onClick={saveCosts}
                disabled={savingCosts || !costsDraft}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
                style={{ background: "var(--primary)", color: "white" }}
              >
                {savedCosts ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                {savingCosts ? "در حال ذخیره…" : savedCosts ? "ذخیره شد" : "ذخیرهٔ تغییرات"}
              </button>
            </div>
            {costsError && <p className="text-xs px-4 py-2 text-red-400">{costsError}</p>}
            {costsDraft && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4">
                {Object.entries(costsDraft).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg" style={{ background: "var(--surface-1)" }}>
                    <span style={{ color: "var(--text-secondary)" }}>{CREDIT_COST_LABELS[key] ?? TOOL_COST_LABELS[key] ?? key}</span>
                    <input
                      type="number"
                      min={0}
                      value={value}
                      onChange={(e) => updateCostDraft(key, Number(e.target.value))}
                      className="w-16 px-2 py-1 rounded-lg text-xs text-left"
                      style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* plan limits — editable, persisted to SiteSetting (key "planLimits"), no deploy needed */}
          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            <div className="px-4 py-3 flex items-center justify-between gap-2" style={{ background: "var(--surface-1)", borderBottom: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>سقف مصرف هر پلن (Limit) — قابل‌ویرایش، بدون نیاز به دیپلوی</span>
              </div>
              <button
                onClick={saveLimits}
                disabled={savingLimits || !limitsDraft}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
                style={{ background: "var(--primary)", color: "white" }}
              >
                {savedLimits ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                {savingLimits ? "در حال ذخیره…" : savedLimits ? "ذخیره شد" : "ذخیرهٔ تغییرات"}
              </button>
            </div>
            {limitsError && <p className="text-xs px-4 py-2 text-red-400">{limitsError}</p>}
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: "var(--surface-1)", borderBottom: "1px solid var(--border)" }}>
                  {["پلن", "چت روزانه", "تصویر ماهانه", "ویدیو ماهانه", "موزیک ماهانه", "اعتبار اولیه"].map((h) => (
                    <th key={h} className="px-4 py-2 text-right font-medium" style={{ color: "var(--text-muted)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(limitsDraft ?? stats.planLimits).map(([plan, limits], i) => (
                  <tr key={plan} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "var(--surface-0)" : "var(--surface-1)" }}>
                    <td className="px-4 py-2.5 font-medium" style={{ color: "var(--text-primary)" }}>{PLAN_LABELS[plan] ?? plan}</td>
                    {(["dailyChats", "monthlyImages", "monthlyVideos", "monthlyMusics", "initialCredits"] as const).map((field) => (
                      <td key={field} className="px-4 py-1.5">
                        <input
                          type="number"
                          value={limits[field]}
                          onChange={(e) => updateDraft(plan, field, Number(e.target.value))}
                          className="w-24 px-2 py-1.5 rounded-lg text-xs"
                          style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs px-4 py-3" style={{ color: "var(--text-muted)", background: "var(--surface-1)" }}>
              برای «نامحدود» عدد <code>-1</code> بذارید. تغییرات فوری روی محدودیت واقعی تولید تصویر/ویدیو/موزیک اثر می‌کنه (چت هنوز بر پایهٔ اعتبار محدود می‌شه، نه شمارش روزانه).
            </p>
          </div>
        </>
      )}
    </div>
  );
}
