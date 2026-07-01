"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Edit2, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import toast from "react-hot-toast";

type Category = { id: string; name: string; nameEn: string; icon: string; color: string; isActive: boolean; sortOrder: number; _count?: { companies: number } };

export default function AdminCategoriesPage() {
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<Partial<Category> | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/admin/categories");
    const d = await r.json();
    setCats(d.categories || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save() {
    if (!edit) return;
    setSaving(true);
    try {
      const method = edit.id ? "PUT" : "POST";
      const r = await fetch("/api/admin/categories", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(edit) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast.success("ذخیره شد");
      setShowModal(false);
      setEdit(null);
      load();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "خطا"); }
    finally { setSaving(false); }
  }

  async function toggleActive(cat: Category) {
    await fetch("/api/admin/categories", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: cat.id, isActive: !cat.isActive }) });
    load();
  }

  async function deleteCat(id: string) {
    if (!confirm("حذف این دسته‌بندی؟")) return;
    const r = await fetch(`/api/admin/categories?id=${id}`, { method: "DELETE" });
    if (r.ok) { toast.success("حذف شد"); load(); } else toast.error("خطا در حذف");
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>دسته‌بندی کسب‌وکار</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>{cats.length} دسته‌بندی</p>
        </div>
        <button onClick={() => { setEdit({ name: "", nameEn: "", icon: "🏢", color: "#ea580c", isActive: true, sortOrder: 0 }); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: "var(--primary)" }}>
          <Plus className="w-4 h-4" /> دسته جدید
        </button>
      </div>

      {loading ? (
        <div className="text-center py-20" style={{ color: "var(--text-muted)" }}>در حال بارگذاری...</div>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {cats.map(cat => (
            <div key={cat.id} className="flex items-center gap-4 p-3 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
              <span className="text-2xl">{cat.icon}</span>
              <div className="flex-1">
                <div className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>{cat.name}</div>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>{cat.nameEn} · {cat._count?.companies || 0} شرکت</div>
              </div>
              <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: cat.color }} />
              <div className="flex items-center gap-2">
                <button onClick={() => toggleActive(cat)} style={{ color: cat.isActive ? "var(--primary)" : "var(--text-muted)" }}>
                  {cat.isActive ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                </button>
                <button onClick={() => { setEdit(cat); setShowModal(true); }} style={{ color: "var(--text-secondary)" }}><Edit2 className="w-4 h-4" /></button>
                <button onClick={() => deleteCat(cat.id)} style={{ color: "#ef4444" }}><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && edit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{edit.id ? "ویرایش دسته" : "دسته جدید"}</h2>
            {(["name", "nameEn", "icon", "color"] as const).map(field => (
              <div key={field}>
                <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>{field}</label>
                <input value={(edit as Record<string, string>)[field] || ""} onChange={e => setEdit({ ...edit, [field]: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
              </div>
            ))}
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>sortOrder</label>
              <input type="number" value={edit.sortOrder || 0} onChange={e => setEdit({ ...edit, sortOrder: +e.target.value })}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none" dir="ltr"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={edit.isActive ?? true} onChange={e => setEdit({ ...edit, isActive: e.target.checked })} />
              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>فعال</span>
            </label>
            <div className="flex gap-3">
              <button onClick={save} disabled={saving} className="flex-1 py-2 rounded-xl text-white text-sm font-medium disabled:opacity-50" style={{ background: "var(--primary)" }}>
                {saving ? "..." : "ذخیره"}
              </button>
              <button onClick={() => { setShowModal(false); setEdit(null); }} className="flex-1 py-2 rounded-xl text-sm" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>لغو</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
