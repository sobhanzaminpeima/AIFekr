"use client";

import { useState, useEffect, useCallback } from "react";
import { AlertTriangle, RefreshCw, Clock, Zap, ArrowRight, BarChart3 } from "lucide-react";

interface FallbackLog {
  id: string;
  fromProvider: string;
  toProvider: string | null;
  reason: string;
  category: string;
  createdAt: string;
}

interface Stats {
  totalCount: number;
  hours: number;
  recentLogs: FallbackLog[];
  byFromProvider: { fromProvider: string; count: number }[];
  byCategory: { category: string; count: number }[];
}

const PROVIDER_COLORS: Record<string, string> = {
  claude:   "#ea580c",
  openai:   "#10b981",
  gemini:   "#3b82f6",
  deepseek: "#8b5cf6",
};

const PROVIDER_ICONS: Record<string, string> = {
  claude:   "🟠",
  openai:   "🟢",
  gemini:   "🔵",
  deepseek: "🟣",
};

export default function ProviderFallbackPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [hours, setHours] = useState(24);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/provider-fallback?hours=${hours}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStats(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [hours]);

  useEffect(() => { load(); }, [load]);

  const providerBadge = (id: string | null) =>
    id ? (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
        style={{
          background: `${PROVIDER_COLORS[id] ?? "#71717a"}22`,
          color: PROVIDER_COLORS[id] ?? "#71717a",
        }}
      >
        {PROVIDER_ICONS[id] ?? "⚪"} {id}
      </span>
    ) : (
      <span className="text-xs text-red-400">all failed</span>
    );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <Zap className="w-5 h-5" style={{ color: "#ea580c" }} />
            AI Provider Fallback Log
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
            Events where the router switched providers due to errors or timeouts
          </p>
        </div>
        <div className="flex items-center gap-2">
          {[6, 24, 48, 168].map((h) => (
            <button
              key={h}
              onClick={() => setHours(h)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: hours === h ? "var(--primary)" : "var(--surface-2)",
                color: hours === h ? "white" : "var(--text-secondary)",
              }}
            >
              {h < 24 ? `${h}h` : h === 168 ? "7d" : `${h / 24}d`}
            </button>
          ))}
          <button
            onClick={load}
            disabled={loading}
            className="p-2 rounded-lg transition-all disabled:opacity-50"
            style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
          >
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

      {stats && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="col-span-2 md:col-span-1 p-4 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4" style={{ color: "#f59e0b" }} />
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>Total fallbacks</span>
              </div>
              <div className="text-3xl font-bold" style={{ color: "#f59e0b" }}>{stats.totalCount}</div>
              <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>last {hours < 24 ? `${hours}h` : hours === 168 ? "7 days" : `${hours / 24} days`}</div>
            </div>

            {/* By provider breakdown */}
            {stats.byFromProvider.slice(0, 3).map(({ fromProvider, count }) => (
              <div key={fromProvider} className="p-4 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs">{PROVIDER_ICONS[fromProvider] ?? "⚪"}</span>
                  <span className="text-xs capitalize" style={{ color: "var(--text-muted)" }}>{fromProvider} failed</span>
                </div>
                <div className="text-2xl font-bold" style={{ color: PROVIDER_COLORS[fromProvider] ?? "#71717a" }}>{count}</div>
                <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                  {stats.totalCount > 0 ? Math.round((count / stats.totalCount) * 100) : 0}% of total
                </div>
              </div>
            ))}
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* By provider bar */}
            <div className="p-5 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-4 h-4" style={{ color: "var(--primary)" }} />
                <h3 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Failures by Provider</h3>
              </div>
              {stats.byFromProvider.length === 0 ? (
                <p className="text-xs text-center py-6" style={{ color: "var(--text-muted)" }}>No fallbacks — all providers healthy ✓</p>
              ) : (
                <div className="space-y-3">
                  {stats.byFromProvider.map(({ fromProvider, count }) => {
                    const pct = stats.totalCount > 0 ? (count / stats.totalCount) * 100 : 0;
                    const color = PROVIDER_COLORS[fromProvider] ?? "#71717a";
                    return (
                      <div key={fromProvider}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="capitalize font-medium" style={{ color: "var(--text-primary)" }}>
                            {PROVIDER_ICONS[fromProvider]} {fromProvider}
                          </span>
                          <span style={{ color: "var(--text-muted)" }}>{count} ({pct.toFixed(0)}%)</span>
                        </div>
                        <div className="h-2 rounded-full" style={{ background: "var(--surface-2)" }}>
                          <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* By category */}
            <div className="p-5 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-4 h-4" style={{ color: "#8b5cf6" }} />
                <h3 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>Failures by Category</h3>
              </div>
              {stats.byCategory.length === 0 ? (
                <p className="text-xs text-center py-6" style={{ color: "var(--text-muted)" }}>No data</p>
              ) : (
                <div className="space-y-3">
                  {stats.byCategory.map(({ category, count }) => {
                    const pct = stats.totalCount > 0 ? (count / stats.totalCount) * 100 : 0;
                    return (
                      <div key={category}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="capitalize font-medium" style={{ color: "var(--text-primary)" }}>{category}</span>
                          <span style={{ color: "var(--text-muted)" }}>{count} ({pct.toFixed(0)}%)</span>
                        </div>
                        <div className="h-2 rounded-full" style={{ background: "var(--surface-2)" }}>
                          <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, background: "#8b5cf6" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Recent events table */}
          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            <div className="px-4 py-3 flex items-center gap-2" style={{ background: "var(--surface-1)", borderBottom: "1px solid var(--border)" }}>
              <Clock className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
              <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Recent fallback events</span>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: "var(--surface-1)", borderBottom: "1px solid var(--border)" }}>
                  {["Time", "Failed", "", "Picked up", "Category", "Reason"].map((h) => (
                    <th key={h} className="px-4 py-2 text-left font-medium" style={{ color: "var(--text-muted)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.recentLogs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center" style={{ color: "var(--text-muted)" }}>
                      No fallback events in this period — all providers are behaving ✓
                    </td>
                  </tr>
                )}
                {stats.recentLogs.map((log, i) => (
                  <tr
                    key={log.id}
                    style={{
                      borderBottom: i < stats.recentLogs.length - 1 ? "1px solid var(--border)" : undefined,
                      background: i % 2 === 0 ? "var(--surface-0)" : "var(--surface-1)",
                    }}
                  >
                    <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                      {new Date(log.createdAt).toLocaleString("en-GB", { hour12: false, month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </td>
                    <td className="px-4 py-2.5">{providerBadge(log.fromProvider)}</td>
                    <td className="px-2 py-2.5">
                      <ArrowRight className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
                    </td>
                    <td className="px-4 py-2.5">{providerBadge(log.toProvider)}</td>
                    <td className="px-4 py-2.5">
                      <span className="px-2 py-0.5 rounded-full" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
                        {log.category}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 max-w-xs truncate" style={{ color: "var(--text-secondary)" }} title={log.reason}>
                      {log.reason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
