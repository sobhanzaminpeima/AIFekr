"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import { Database, Server, Cpu, RefreshCw, AlertTriangle, CheckCircle, Activity, MinusCircle } from "lucide-react";
import Link from "next/link";
import { toJalali } from "@/lib/utils/jalali";

/**
 * Every figure on this page used to be invented: CPU "23%", memory
 * "512MB / 2GB", uptime from Math.random(), services hardcoded to "running" on
 * port 3003, a fixed list of fake log lines, and action buttons (clear cache,
 * back up DB, restart server, purge logs) that only showed a success toast
 * without doing anything. QA 2026-09-15 couldn't tell whether any of it was
 * real. It now shows only what /api/admin/system actually measures, and the
 * do-nothing buttons are gone.
 */

interface SystemStatus {
  process: { uptimeSeconds: number; memoryRssMb: number; heapUsedMb: number; nodeVersion: string };
  database: { ok: boolean; latencyMs: number | null; error: string | null };
  integrations: { key: string; name: string; configured: boolean }[];
  recentErrors: { id: string; level: string; source: string; message: string; createdAt: string }[];
  checkedAt: string;
}

function fmtUptime(s: number) {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m`;
}

export default function SystemPage() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const res = await fetch("/api/admin/system", { credentials: "include" });
      if (!res.ok) throw new Error(String(res.status));
      setStatus(await res.json());
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>مدیریت سیستم</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
            وضعیت واقعی پروسهٔ اپلیکیشن، دیتابیس و سرویس‌های متصل
            {status && ` · بررسی‌شده در ${toJalali(status.checkedAt)}`}
          </p>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50" style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> به‌روزرسانی
        </button>
      </div>

      {failed && (
        <div className="p-4 rounded-2xl text-sm" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444" }}>
          دریافت وضعیت سیستم ناموفق بود.
        </div>
      )}

      {status && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Uptime (پروسه)", value: fmtUptime(status.process.uptimeSeconds), color: "#8b5cf6", icon: Activity },
              { label: "Memory (RSS)", value: `${status.process.memoryRssMb} MB`, color: "#3b82f6", icon: Server },
              { label: "Heap used", value: `${status.process.heapUsedMb} MB`, color: "#10b981", icon: Cpu },
              { label: "Node.js", value: status.process.nodeVersion, color: "#f59e0b", icon: Server },
            ].map((s) => (
              <div key={s.label} className="p-4 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
                <div className="flex items-center gap-2 mb-2">
                  <s.icon className="w-4 h-4" style={{ color: s.color }} />
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>{s.label}</span>
                </div>
                <div className="text-lg font-bold" style={{ color: s.color }} dir="ltr">{s.value}</div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl p-5 space-y-3" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <h2 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>دیتابیس و سرویس‌ها</h2>
            <div className="space-y-2">
              <div className="flex items-center justify-between py-2" style={{ borderBottom: "1px solid var(--border)" }}>
                <div className="flex items-center gap-2">
                  {status.database.ok ? <CheckCircle className="w-4 h-4" style={{ color: "#10b981" }} /> : <AlertTriangle className="w-4 h-4" style={{ color: "#ef4444" }} />}
                  <Database className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                  <span className="text-sm" style={{ color: "var(--text-primary)" }}>Database (SQLite)</span>
                  {status.database.latencyMs != null && <span className="text-xs" style={{ color: "var(--text-muted)" }} dir="ltr">{status.database.latencyMs} ms</span>}
                </div>
                <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: status.database.ok ? "#10b98120" : "#ef444420", color: status.database.ok ? "#10b981" : "#ef4444" }}>
                  {status.database.ok ? "پاسخ‌گو" : "خطا"}
                </span>
              </div>
              {status.integrations.map((i) => (
                <div key={i.key} className="flex items-center justify-between py-2" style={{ borderBottom: "1px solid var(--border)" }}>
                  <div className="flex items-center gap-2">
                    {i.configured ? <CheckCircle className="w-4 h-4" style={{ color: "#10b981" }} /> : <MinusCircle className="w-4 h-4" style={{ color: "var(--text-muted)" }} />}
                    <span className="text-sm" style={{ color: "var(--text-primary)" }}>{i.name}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: i.configured ? "#10b98120" : "var(--surface-2)", color: i.configured ? "#10b981" : "var(--text-muted)" }}>
                    {i.configured ? "پیکربندی شده" : "پیکربندی نشده"}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              «پیکربندی شده» یعنی کلیدهای لازم روی سرور تنظیم شده‌اند؛ سالم‌بودن سرویس بیرونی را جداگانه تست نمی‌کند.
            </p>
          </div>

          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            <div className="px-4 py-3 flex items-center justify-between" style={{ background: "var(--surface-1)", borderBottom: "1px solid var(--border)" }}>
              <h2 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>آخرین خطاهای ثبت‌شده</h2>
              <Link href="/admin/logs" className="text-xs" style={{ color: "var(--primary)" }}>همه ←</Link>
            </div>
            {status.recentErrors.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm" style={{ color: "var(--text-muted)", background: "var(--surface-0)" }}>خطایی ثبت نشده است.</p>
            ) : (
              <div style={{ background: "var(--surface-0)" }}>
                {status.recentErrors.map((e) => (
                  <div key={e.id} className="px-4 py-2.5 flex items-start gap-3 text-xs" style={{ borderTop: "1px solid var(--border)" }}>
                    <span style={{ color: "var(--text-muted)" }}>{toJalali(e.createdAt)}</span>
                    <span className="px-1.5 py-0.5 rounded font-bold" style={{ background: e.level === "warn" ? "#f59e0b20" : "#ef444420", color: e.level === "warn" ? "#f59e0b" : "#ef4444" }}>
                      {e.level === "warn" ? "WARN" : "ERROR"}
                    </span>
                    <span className="flex-1 min-w-0 truncate" style={{ color: "var(--text-secondary)" }} dir="ltr">{e.source} — {e.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
