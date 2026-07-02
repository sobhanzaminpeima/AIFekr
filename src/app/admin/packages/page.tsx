"use client";

import { useState, useEffect, useCallback } from "react";
import { Package, Plus, Edit2, Trash2, ToggleLeft, ToggleRight, Star, Check, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

type Pkg = {
  id: string; name: string; nameEn: string; price: number; duration: number;
  credits: number; isActive: boolean; isFeatured: boolean; color: string;
  features: string; sortOrder: number;
};

const EMPTY_FORM = { name: "", nameEn: "", price: 0, duration: 30, credits: 1000, color: "#ea580c", features: "", sortOrder: 0 };

export default function PackagesPage() {
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Pkg | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/packages", { credentials: "include" });
      const d = await r.json();
      if (r.ok) setPackages(d.packages || []);
      else toast.error(d.error || "خطا در بارگذاری");
    } catch { toast.error("خطا در اتصال"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openEdit(p: Pkg) {
    setEditing(p);
    setForm({ name: p.name, nameEn: p.nameEn, price: p.price, duration: p.duration, credits: p.credits, color: p.color, features: p.features, sortOrder: p.sortOrder });
    setShowForm(true);
  }
  function openAdd() { setEditing(null); setForm(EMPTY_FORM); setShowForm(true); }

  async function handleSave() {
    if (!form.name) return toast.error("نام الزامی است");
    setSaving(true);
    try {
      const method = editing ? "PUT" : "POST";
      const body = editing ? { id: editing.id, ...form } : form;
      const r = await fetch("/api/admin/packages", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast.success(editing ? "پکیج آپدیت شد" : "پکیج ایجاد شد");
      setShowForm(false);
      load();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "خطا"); }
    finally { setSaving(false); }
  }

  async function toggleActive(p: Pkg) {
    await fetch("/api/admin/packages", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: p.id, isActive: !p.isActive }) });
    load();
  }

  async function setFeatured(p: Pkg) {
    await fetch("/api/admin/packages", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: p.id, isFeatured: !p.isFeatured }) });
    toast.success("ویژه تغییر کرد");
    load();
  }

  async function deletePkg(id: string) {
    if (!confirm("حذف شود؟")) return;
    const r = await fetch(`/api/admin/packages?id=${id}`, { method: "DELETE" });
    if (r.ok) { toast.success("حذف شد"); load(); }
    else toast.error("خطا در حذف");
  }

  const COLORS = ["#71717a", "#3b82f6", "#ea580c", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444"];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>مدیریت پکیج‌ها</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>تعریف پلن‌های اشتراک عمومی ({packages.length} پکیج)</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: "var(--primary)" }}>
          <Plus className="w-4 h-4" /> افزودن پکیج
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--primary)" }} /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {packages.map(p => (
            <div key={p.id} className="rounded-2xl overflow-hidden relative" style={{ border: `2px solid ${p.isFeatured ? p.color : "var(--border)"}`, background: "var(--surface-1)" }}>
              {p.isFeatured && (
                <div className="absolute top-0 left-0 right-0 py-1 text-center text-xs font-bold text-white" style={{ background: p.color }}>⭐ ویژه</div>
              )}
              <div className={`p-4 ${p.isFeatured ? "pt-8" : ""}`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-bold" style={{ color: p.color }}>{p.name}</div>
                    <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{p.nameEn}</div>
                  </div>
                  <div className={`w-2 h-2 rounded-full mt-1 ${p.isActive ? "bg-green-500" : "bg-red-500"}`} />
                </div>
                <div className="text-2xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
                  {p.price === 0 ? "رایگان" : (p.price / 10).toLocaleString("fa-IR") + " ت"}
                </div>
                {p.price > 0 && <div className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>{p.duration} روز · {p.credits.toLocaleString("fa-IR")} اعتبار</div>}
                <ul className="space-y-1 mb-4">
                  {p.features.split("\n").filter(Boolean).map((f, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs">
                      <Check className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: p.color }} />
                      <span style={{ color: "var(--text-secondary)" }}>{f}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex items-center gap-1.5 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                  <button onClick={() => setFeatured(p)} className="p-1.5 rounded-lg flex-shrink-0" style={{ color: p.isFeatured ? "#f59e0b" : "var(--text-muted)" }}>
                    <Star className={`w-4 h-4 ${p.isFeatured ? "fill-current" : ""}`} />
                  </button>
                  <button onClick={() => toggleActive(p)} className="p-1.5 rounded-lg flex-shrink-0" style={{ color: p.isActive ? "#10b981" : "#ef4444" }}>
                    {p.isActive ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                  </button>
                  <button onClick={() => openEdit(p)} className="flex-1 py-1.5 rounded-xl text-xs font-medium" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
                    <Edit2 className="w-3.5 h-3.5 inline ml-1" />ویرایش
                  </button>
                  <button onClick={() => deletePkg(p.id)} className="p-1.5 rounded-lg" style={{ color: "#ef4444" }}><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div className="w-full max-w-lg rounded-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <h2 className="font-bold" style={{ color: "var(--text-primary)" }}>{editing ? "ویرایش پکیج" : "افزودن پکیج جدید"}</h2>
            <div className="grid grid-cols-2 gap-3">
              {[{ label: "نام فارسی", key: "name" }, { label: "نام انگلیسی", key: "nameEn" }].map(f => (
                <div key={f.key}>
                  <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>{f.label}</label>
                  <input value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[{ label: "قیمت (ریال)", key: "price" }, { label: "مدت (روز)", key: "duration" }, { label: "اعتبار", key: "credits" }].map(f => (
                <div key={f.key}>
                  <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>{f.label}</label>
                  <input type="number" value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: Number(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                </div>
              ))}
            </div>
            <div>
              <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>رنگ</label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map(c => (
                  <button key={c} onClick={() => setForm(p => ({ ...p, color: c }))}
                    className="w-8 h-8 rounded-lg border-2 transition-all"
                    style={{ background: c, borderColor: form.color === c ? "white" : "transparent" }} />
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>امکانات (هر خط یک امکان)</label>
              <textarea value={form.features} onChange={e => setForm(p => ({ ...p, features: e.target.value }))} rows={5}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={handleSave} disabled={saving} className="flex-1 py-2 rounded-xl font-semibold text-sm text-white disabled:opacity-50" style={{ background: "var(--primary)" }}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "ذخیره"}
              </button>
              <button onClick={() => setShowForm(false)} className="flex-1 py-2 rounded-xl text-sm" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>انصراف</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}