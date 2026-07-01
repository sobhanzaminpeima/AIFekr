"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { Database, Server, HardDrive, Cpu, RefreshCw, Trash2, AlertTriangle, CheckCircle, Activity } from "lucide-react";
import toast from "react-hot-toast";

export default function SystemPage() {
  const [uptime] = useState(Math.floor(Math.random() * 86400 * 7));
  const [clearing, setClearing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const uptimeStr = `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`;

  const stats = [
    { label: "CPU", value: "23%", color: "#10b981", icon: Cpu },
    { label: "Memory", value: "512MB / 2GB", color: "#3b82f6", icon: Server },
    { label: "Storage", value: "1.2GB / 10GB", color: "#f59e0b", icon: HardDrive },
    { label: "Uptime", value: uptimeStr, color: "#8b5cf6", icon: Activity },
  ];

  const services = [
    { name: "API Server", status: "running", port: 3003 },
    { name: "Database (SQLite)", status: "running", port: null },
    { name: "Prisma Client", status: "running", port: null },
    { name: "Cache Layer", status: "stopped", port: 6379 },
    { name: "Email Service", status: "stopped", port: null },
    { name: "SMS Gateway", status: "stopped", port: null },
  ];

  const logs = [
    { time: "۱۲:۳۰", level: "info", msg: "API Server started on port 3003" },
    { time: "۱۲:۲۹", level: "info", msg: "Database connection established" },
    { time: "۱۱:۵۵", level: "warn", msg: "High memory usage detected (85%)" },
    { time: "۱۱:۲۰", level: "error", msg: "Failed to connect to SMS gateway" },
    { time: "۱۰:۴۵", level: "info", msg: "Prisma migrate applied successfully" },
  ];

  async function clearCache() {
    setClearing(true);
    await new Promise(r => setTimeout(r, 1200));
    setClearing(false);
    toast.success("کش پاک شد");
  }

  async function refresh() {
    setRefreshing(true);
    await new Promise(r => setTimeout(r, 800));
    setRefreshing(false);
    toast.success("وضعیت به‌روز شد");
  }

  const levelColor: Record<string, string> = { info: "#3b82f6", warn: "#f59e0b", error: "#ef4444" };
  const levelLabel: Record<string, string> = { info: "INFO", warn: "WARN", error: "ERROR" };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>مدیریت سیستم</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>وضعیت سرور، سرویس‌ها و ابزارهای مدیریتی</p>
        </div>
        <button onClick={refresh} disabled={refreshing} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium" style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} /> به‌روزرسانی
        </button>
      </div>

      {/* System stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className="p-4 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2 mb-2">
              <s.icon className="w-4 h-4" style={{ color: s.color }} />
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>{s.label}</span>
            </div>
            <div className="text-lg font-bold" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Services */}
      <div className="rounded-2xl p-5 space-y-3" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <h2 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>وضعیت سرویس‌ها</h2>
        <div className="space-y-2">
          {services.map(s => (
            <div key={s.name} className="flex items-center justify-between py-2" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="flex items-center gap-2">
                {s.status === "running"
                  ? <CheckCircle className="w-4 h-4" style={{ color: "#10b981" }} />
                  : <AlertTriangle className="w-4 h-4" style={{ color: "#ef4444" }} />}
                <span className="text-sm" style={{ color: "var(--text-primary)" }}>{s.name}</span>
                {s.port && <span className="text-xs" style={{ color: "var(--text-muted)" }}>:{s.port}</span>}
              </div>
              <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: s.status === "running" ? "#10b98120" : "#ef444420", color: s.status === "running" ? "#10b981" : "#ef4444" }}>
                {s.status === "running" ? "فعال" : "متوقف"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "پاک کردن کش", icon: Trash2, color: "#f59e0b", action: clearCache, loading: clearing },
          { label: "بک‌آپ دیتابیس", icon: Database, color: "#3b82f6", action: () => toast("بک‌آپ گیری آغاز شد"), loading: false },
          { label: "ری‌استارت سرور", icon: Server, color: "#ef4444", action: () => { if (confirm("سرور ری‌استارت شود؟")) toast("ری‌استارت انجام شد"); }, loading: false },
          { label: "پاکسازی لاگ‌ها", icon: Activity, color: "#8b5cf6", action: () => toast("لاگ‌های قدیمی پاک شدند"), loading: false },
        ].map(a => (
          <button key={a.label} onClick={a.action} disabled={a.loading}
            className="p-4 rounded-2xl flex flex-col items-center gap-2 transition-all disabled:opacity-50"
            style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <a.icon className="w-5 h-5" style={{ color: a.color }} />
            <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{a.label}</span>
          </button>
        ))}
      </div>

      {/* Recent logs */}
      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <div className="px-4 py-3 flex items-center justify-between" style={{ background: "var(--surface-1)", borderBottom: "1px solid var(--border)" }}>
          <h2 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>لاگ‌های اخیر</h2>
        </div>
        <div className="divide-y" style={{ borderColor: "var(--border)" }}>
          {logs.map((log, i) => (
            <div key={i} className="px-4 py-2.5 flex items-start gap-3 font-mono text-xs" style={{ background: "var(--surface-0)" }}>
              <span style={{ color: "var(--text-muted)" }}>{log.time}</span>
              <span className="px-1.5 py-0.5 rounded text-xs font-bold" style={{ background: `${levelColor[log.level]}20`, color: levelColor[log.level] }}>{levelLabel[log.level]}</span>
              <span style={{ color: "var(--text-secondary)" }}>{log.msg}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
