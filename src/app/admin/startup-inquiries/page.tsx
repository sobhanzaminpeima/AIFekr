"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import { Rocket, RefreshCw, Trash2, MessageSquare, Mail, Phone, CheckCircle2, Clock, XCircle, Eye } from "lucide-react";
import toast from "react-hot-toast";

interface Inquiry {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  startupName: string | null;
  message: string;
  stage: string;
  adminNote: string | null;
  createdAt: string;
  user: { name: string | null; email: string | null } | null;
}

const STAGES = [
  { value: "all", label: "همه", color: "#6b7280" },
  { value: "new", label: "جدید", color: "#3b82f6" },
  { value: "read", label: "خوانده‌شده", color: "#f59e0b" },
  { value: "replied", label: "پاسخ‌داده‌شده", color: "#10b981" },
  { value: "closed", label: "بسته‌شده", color: "#6b7280" },
];

const STAGE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  new: Clock,
  read: Eye,
  replied: CheckCircle2,
  closed: XCircle,
};

export default function StartupInquiriesPage() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<Inquiry | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/startup-inquiries?stage=${filter}`, { credentials: "include" });
      const data = await res.json();
      setInquiries(data.inquiries || []);
    } catch { toast.error("خطا در بارگذاری"); }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  function openDetail(inq: Inquiry) {
    setSelected(inq);
    setAdminNote(inq.adminNote || "");
    if (inq.stage === "new") updateStage(inq.id, "read");
  }

  async function updateStage(id: string, stage: string) {
    await fetch("/api/admin/startup-inquiries", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, stage }),
    });
    setInquiries((prev) => prev.map((i) => i.id === id ? { ...i, stage } : i));
    if (selected?.id === id) setSelected((s) => s ? { ...s, stage } : s);
  }

  async function saveNote() {
    if (!selected) return;
    setSaving(true);
    try {
      await fetch("/api/admin/startup-inquiries", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id, adminNote }),
      });
      setSelected((s) => s ? { ...s, adminNote } : s);
      setInquiries((prev) => prev.map((i) => i.id === selected.id ? { ...i, adminNote } : i));
      toast.success("یادداشت ذخیره شد");
    } catch { toast.error("خطا"); }
    finally { setSaving(false); }
  }

  async function deleteInquiry(id: string) {
    if (!confirm("حذف شود؟")) return;
    await fetch("/api/admin/startup-inquiries", {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setInquiries((p) => p.filter((i) => i.id !== id));
    if (selected?.id === id) setSelected(null);
    toast.success("حذف شد");
  }

  const stageColor = (s: string) => STAGES.find((x) => x.value === s)?.color || "#6b7280";

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <Rocket className="w-5 h-5" style={{ color: "var(--primary)" }} />
            استعلام‌های استارتاپ
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
            درخواست‌های پیاده‌سازی استارتاپ از کاربران
          </p>
        </div>
        <button onClick={load} disabled={loading} className="p-2 rounded-xl" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {STAGES.slice(1).map((s) => (
          <div key={s.value} className="p-4 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <div className="text-2xl font-bold" style={{ color: s.color }}>
              {inquiries.filter((i) => i.stage === s.value).length}
            </div>
            <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {STAGES.map((s) => (
          <button
            key={s.value}
            onClick={() => setFilter(s.value)}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={{
              background: filter === s.value ? s.color : "var(--surface-1)",
              color: filter === s.value ? "white" : "var(--text-secondary)",
              border: "1px solid var(--border)",
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* List */}
        <div className="lg:col-span-2 space-y-2">
          {inquiries.length === 0 && !loading && (
            <p className="text-center py-10 text-sm" style={{ color: "var(--text-muted)" }}>استعلامی یافت نشد</p>
          )}
          {inquiries.map((inq) => {
            const StageIcon = STAGE_ICONS[inq.stage] || Clock;
            return (
              <div
                key={inq.id}
                onClick={() => openDetail(inq)}
                className="p-4 rounded-2xl cursor-pointer transition-all group"
                style={{
                  background: selected?.id === inq.id ? "var(--surface-2)" : "var(--surface-1)",
                  border: `1px solid ${selected?.id === inq.id ? "var(--primary)" : "var(--border)"}`,
                  opacity: inq.stage === "closed" ? 0.6 : 1,
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-medium text-sm truncate" style={{ color: "var(--text-primary)" }}>{inq.name}</span>
                      {inq.stage === "new" && (
                        <span className="px-1.5 py-0.5 rounded-full text-xs font-bold" style={{ background: "#3b82f620", color: "#3b82f6" }}>NEW</span>
                      )}
                    </div>
                    {inq.startupName && (
                      <div className="text-xs mb-1" style={{ color: "var(--primary)" }}>🚀 {inq.startupName}</div>
                    )}
                    <p className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{inq.message}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <StageIcon className="w-3.5 h-3.5" style={{ color: stageColor(inq.stage) }} />
                      <span className="text-xs" style={{ color: stageColor(inq.stage) }}>
                        {STAGES.find((s) => s.value === inq.stage)?.label}
                      </span>
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {new Date(inq.createdAt).toLocaleDateString("fa-IR")}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteInquiry(inq.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg flex-shrink-0"
                    style={{ color: "#ef4444" }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Detail */}
        <div className="lg:col-span-3">
          {!selected ? (
            <div className="flex flex-col items-center justify-center min-h-64 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px dashed var(--border)" }}>
              <MessageSquare className="w-10 h-10 mb-3 opacity-20" style={{ color: "var(--text-muted)" }} />
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>یک استعلام انتخاب کنید</p>
            </div>
          ) : (
            <div className="p-5 rounded-2xl space-y-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
              {/* Contact info */}
              <div className="space-y-2">
                <h3 className="font-bold text-base" style={{ color: "var(--text-primary)" }}>{selected.name}</h3>
                {selected.startupName && (
                  <div className="text-sm font-medium" style={{ color: "var(--primary)" }}>🚀 {selected.startupName}</div>
                )}
                <div className="flex flex-wrap gap-3 text-xs" style={{ color: "var(--text-muted)" }}>
                  <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{selected.email}</span>
                  {selected.phone && <span className="flex items-center gap-1" dir="ltr"><Phone className="w-3.5 h-3.5" />{selected.phone}</span>}
                </div>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                  ثبت: {new Date(selected.createdAt).toLocaleString("fa-IR")}
                </div>
              </div>

              {/* Message */}
              <div className="p-4 rounded-xl text-sm leading-relaxed" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
                {selected.message}
              </div>

              {/* Stage control */}
              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-muted)" }}>وضعیت</p>
                <div className="flex flex-wrap gap-2">
                  {STAGES.slice(1).map((s) => (
                    <button
                      key={s.value}
                      onClick={() => updateStage(selected.id, s.value)}
                      className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
                      style={{
                        background: selected.stage === s.value ? s.color : "var(--surface-2)",
                        color: selected.stage === s.value ? "white" : "var(--text-secondary)",
                      }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Admin note */}
              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-muted)" }}>یادداشت داخلی</p>
                <textarea
                  rows={3}
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="یادداشت خصوصی برای تیم..."
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none mb-2"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                />
                <button
                  onClick={saveNote}
                  disabled={saving}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-white"
                  style={{ background: "var(--primary)" }}
                >
                  {saving ? "ذخیره..." : "ذخیره یادداشت"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
