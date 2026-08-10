"use client";

import { useState, useEffect, useCallback } from "react";
import { Activity, AlertTriangle, Loader2 } from "lucide-react";
import { toJalali } from "@/lib/utils/jalali";

type Tab = "api" | "errors";

interface LogEntry {
  id: string;
  userId: string;
  userName: string;
  model: string | null;
  type: string;
  credits: number;
  createdAt: string;
  metadata: string | null;
}

export default function AdminLogsPage() {
  const [tab, setTab] = useState<Tab>("api");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/admin/logs");
      if (!res.ok) {
        setError(true);
        return;
      }
      const data = await res.json();
      setLogs(data.logs || []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>لاگ‌ها و مانیتورینگ</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>گزارش فعالیت‌ها و خطاهای سیستم</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {([["api", "لاگ API", Activity], ["errors", "خطاها", AlertTriangle]] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={{
              background: tab === id ? "var(--primary)" : "var(--surface-1)",
              color: tab === id ? "white" : "var(--text-secondary)",
              border: "1px solid var(--border)",
            }}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        {tab === "api" ? (
          loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--primary)" }} />
            </div>
          ) : error ? (
            <div className="text-center py-16 text-sm" style={{ color: "var(--danger)" }}>
              خطا در دریافت لاگ‌ها. لطفاً دوباره تلاش کنید.
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-16 text-sm" style={{ color: "var(--text-secondary)" }}>
              هنوز لاگی ثبت نشده است.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["زمان", "کاربر", "نوع", "مدل", "اعتبار"].map((h) => (
                    <th key={h} className="px-4 py-3 text-right font-medium" style={{ color: "var(--text-secondary)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>{toJalali(log.createdAt)}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>{log.userName}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: "rgba(234,88,12,0.1)", color: "var(--primary)" }}>
                        {log.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--text-secondary)" }}>{log.model || "—"}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--text-primary)" }}>{log.credits}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : (
          <div className="text-center py-16 text-sm" style={{ color: "var(--text-secondary)" }}>
            سیستم ثبت خطا (Error Logging) هنوز پیاده‌سازی نشده است — این بخش نیاز به تصمیم مالک محصول دارد.
          </div>
        )}
      </div>
    </div>
  );
}
