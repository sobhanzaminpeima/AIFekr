"use client";

import { useState, useEffect } from "react";
import { Puzzle, CheckCircle, XCircle, AlertCircle, RefreshCw } from "lucide-react";

interface Module {
  id: string; key: string; name: string; description: string | null;
  status: string; minPlan: string; isCore: boolean; sortOrder: number;
}

const STATUS_COLORS: Record<string, string> = {
  enabled: "#22c55e", disabled: "#ef4444", maintenance: "#f59e0b", beta: "#8b5cf6",
};
const STATUS_LABELS: Record<string, string> = {
  enabled: "فعال", disabled: "غیرفعال", maintenance: "نگهداری", beta: "بتا",
};

export default function AdminModulesPage() {
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/modules");
      const d = await r.json();
      setModules(d.modules || []);
    } catch {
      setError("خطا در بارگذاری ماژول‌ها");
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function updateModule(key: string, patch: { status?: string; minPlan?: string }) {
    setSaving(key);
    try {
      const r = await fetch("/api/admin/modules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, ...patch }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "خطا");
      setModules(ms => ms.map(m => m.key === key ? { ...m, ...patch } : m));
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا");
    }
    setSaving(null);
  }

  const cardStyle: React.CSSProperties = {
    background: "#141618", border: "1px solid #252729", borderRadius: 12,
    padding: 16, display: "flex", alignItems: "center", gap: 12,
  };

  return (
    <div style={{ padding: 24, direction: "rtl" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <Puzzle size={24} color="#FF6B00" />
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>مدیریت ماژول‌ها</h1>
        <button onClick={load} style={{ marginRight: "auto", padding: "8px 16px", background: "#1e2022", border: "1px solid #252729", borderRadius: 8, color: "#e0e0e0", cursor: "pointer", display: "flex", gap: 6, alignItems: "center" }}>
          <RefreshCw size={14} /> بارگذاری مجدد
        </button>
      </div>

      {error && (
        <div style={{ background: "#3d1a1a", border: "1px solid #c53030", borderRadius: 8, padding: "10px 14px", marginBottom: 16, color: "#fc8181", display: "flex", gap: 8 }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {loading ? (
        <div style={{ color: "#666", textAlign: "center", padding: 40 }}>در حال بارگذاری...</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 12 }}>
          {modules.map(m => (
            <div key={m.key} style={cardStyle}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>{m.name}</span>
                  {m.isCore && <span style={{ fontSize: 10, background: "#1e3a5f", color: "#60a5fa", padding: "2px 6px", borderRadius: 10 }}>هسته</span>}
                  <span style={{ fontSize: 11, color: STATUS_COLORS[m.status] || "#888" }}>
                    {m.status === "enabled" ? <CheckCircle size={12} style={{ display: "inline" }} /> : <XCircle size={12} style={{ display: "inline" }} />}
                    {" "}{STATUS_LABELS[m.status] || m.status}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>کلید: {m.key} | حداقل پلن: {m.minPlan}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <select
                    value={m.status}
                    disabled={!!saving || m.isCore}
                    onChange={e => updateModule(m.key, { status: e.target.value })}
                    style={{ padding: "4px 8px", background: "#1e2022", border: "1px solid #252729", borderRadius: 6, color: "#e0e0e0", fontSize: 12, cursor: m.isCore ? "not-allowed" : "pointer" }}>
                    <option value="enabled">فعال</option>
                    <option value="disabled">غیرفعال</option>
                    <option value="maintenance">نگهداری</option>
                    <option value="beta">بتا</option>
                  </select>
                  <select
                    value={m.minPlan}
                    disabled={!!saving}
                    onChange={e => updateModule(m.key, { minPlan: e.target.value })}
                    style={{ padding: "4px 8px", background: "#1e2022", border: "1px solid #252729", borderRadius: 6, color: "#e0e0e0", fontSize: 12 }}>
                    {["FREE", "BASIC", "PRO", "BUSINESS", "TEAM", "AGENCY"].map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>
              {saving === m.key && <RefreshCw size={16} color="#FF6B00" style={{ animation: "spin 1s linear infinite" }} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
