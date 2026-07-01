"use client";

import { useState } from "react";
import { Activity, AlertTriangle } from "lucide-react";
import { toJalali } from "@/lib/utils/jalali";

type Tab = "api" | "errors";

const SAMPLE_LOGS = [
  { id: "1", userId: "usr_1", model: "claude-haiku-4-5", type: "chat", credits: 1, createdAt: new Date().toISOString(), metadata: null },
  { id: "2", userId: "usr_2", model: "claude-sonnet-4-6", type: "image", credits: 5, createdAt: new Date(Date.now() - 60000).toISOString(), metadata: null },
  { id: "3", userId: "usr_3", model: "claude-haiku-4-5", type: "chat", credits: 1, createdAt: new Date(Date.now() - 120000).toISOString(), metadata: null },
];

export default function AdminLogsPage() {
  const [tab, setTab] = useState<Tab>("api");
  const logs = SAMPLE_LOGS;
  const loading = false;

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

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        {loading ? null : (
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
                  <td className="px-4 py-3 text-xs font-mono" style={{ color: "var(--text-secondary)" }}>{log.userId.slice(0, 8)}...</td>
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
        )}
      </div>
    </div>
  );
}
