"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Edit2, Trash2, ToggleLeft, ToggleRight, Search } from "lucide-react";
import toast from "react-hot-toast";

type Pack = {
  id: string; slug: string; name: string; emoji: string; tagline: string;
  tier: string; price: number; color: string; isActive: boolean; sortOrder: number;
  _count?: { users: number; companies: number };
};

export default function AdminIndustryPacksPage() {
  const [packs, setPacks] = useState<Pack[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editPack, setEditPack] = useState<Partial<Pack> | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/industry-packs", { credentials: "include" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "خطا در دریافت بسته‌ها");
      setPacks(d.packs || []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "خطا در دریافت بسته‌ها");
      setPacks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save() {
    if (!editPack) return;
    setSaving(true);
    try {
      const method = editPack.id ? "PUT" : "POST";
      const r = await fetch("/api/admin/industry-packs", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(editPack) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast.success(editPack.id ? "بسته ویرایش شد" : "بسته ایجاد شد");
      setShowModal(false);
      setEditPack(null);
      load();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "خطا"); }
    finally { setSaving(false); }
  }

  async function toggleActive(pack: Pack) {
    const r = await fetch("/api/admin/industry-packs", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: pack.id, isActive: !pack.isActive }) });
    if (r.ok) { toast.success("وضعیت تغییر کرد"); load(); }
  }

  async function deletePack(id: string) {
    if (!confirm("حذف این بسته؟")) return;
    const r = await fetch(`/api/admin/industry-packs?id=${id}`, { method: "DELETE" });
    if (r.ok) { toast.success("حذف شد"); load(); } else toast.error("خطا در حذف");
  }

  const filtered = packs.filter(p => p.name.includes(search) || p.slug.includes(search));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>مدیریت بسته‌های صنعتی</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>{packs.length} بسته</p>
        </div>
        <button onClick={() => { setEditPack({ tier: "professional", price: 299, color: "#ea580c", gradientFrom: "#ea580c", gradientTo: "#f97316", isActive: true, sortOrder: 0 } as Partial<Pack>); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: "var(--primary)" }}>
          <Plus className="w-4 h-4" /> بسته جدید
        </button>
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="جستجو..." className="w-full pr-10 pl-4 py-2.5 rounded-xl text-sm outline-none"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
      </div>

      {loading ? (
        <div className="text-center py-20" style={{ color: "var(--text-muted)" }}>در حال بارگذاری...</div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filtered.map(pack => (
            <div key={pack.id} className="flex items-center gap-4 p-4 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
              <span className="text-2xl">{pack.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium" style={{ color: "var(--text-primary)" }}>{pack.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${pack.color}22`, color: pack.color }}>{pack.tier}</span>
                  {!pack.isActive && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>غیرفعال</span>}
                </div>
                <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{pack.slug} · ${pack.price}/ماه · {pack._count?.users || 0} کاربر · {pack._count?.companies || 0} شرکت</div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => toggleActive(pack)} style={{ color: pack.isActive ? "var(--primary)" : "var(--text-muted)" }}>
                  {pack.isActive ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                </button>
                <button onClick={() => { setEditPack(pack); setShowModal(true); }} style={{ color: "var(--text-secondary)" }}><Edit2 className="w-4 h-4" /></button>
                <button onClick={() => deletePack(pack.id)} style={{ color: "#ef4444" }}><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && editPack && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div className="w-full max-w-lg rounded-2xl p-6 space-y-4 overflow-y-auto max-h-[90vh]" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{editPack.id ? "ویرایش بسته" : "بسته جدید"}</h2>
            {(["name", "slug", "emoji", "tagline", "tier", "color"] as const).map(field => (
              <div key={field}>
                <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>{field}</label>
                <input value={(editPack as Record<string, string>)[field] || ""} onChange={e => setEditPack({ ...editPack, [field]: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none" dir="ltr"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
              </div>
            ))}
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>price</label>
              <input type="number" value={editPack.price || 0} onChange={e => setEditPack({ ...editPack, price: +e.target.value })}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none" dir="ltr"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>sortOrder</label>
              <input type="number" value={editPack.sortOrder || 0} onChange={e => setEditPack({ ...editPack, sortOrder: +e.target.value })}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none" dir="ltr"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={editPack.isActive ?? true} onChange={e => setEditPack({ ...editPack, isActive: e.target.checked })} />
              <span className="text-sm" style={{ color: "var(--text-secondary)" }}>فعال</span>
            </label>
            <div className="flex gap-3">
              <button onClick={save} disabled={saving} className="flex-1 py-2 rounded-xl text-white text-sm font-medium disabled:opacity-50" style={{ background: "var(--primary)" }}>
                {saving ? "..." : "ذخیره"}
              </button>
              <button onClick={() => { setShowModal(false); setEditPack(null); }} className="flex-1 py-2 rounded-xl text-sm" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
                لغو
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
