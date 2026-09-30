"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

interface Tier {
  id: string;
  creditsAmount: number;
  priceToman: number;
  discountPercent: number;
  badge: string | null;
  sortOrder: number;
  isActive: boolean;
}

const EMPTY_FORM = { creditsAmount: "", priceToman: "", discountPercent: "0", badge: "", sortOrder: "0" };

export default function AdminCreditTiersPage() {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/credit-tiers");
      const data = await res.json();
      setTiers(data.tiers || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function addTier() {
    if (!form.creditsAmount || !form.priceToman) return toast.error("تعداد اعتبار و قیمت الزامی است");
    setSaving(true);
    try {
      const res = await fetch("/api/admin/credit-tiers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creditsAmount: Number(form.creditsAmount),
          priceToman: Number(form.priceToman),
          discountPercent: Number(form.discountPercent),
          badge: form.badge || null,
          sortOrder: Number(form.sortOrder),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("تعرفه اضافه شد");
      setForm(EMPTY_FORM);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در ثبت تعرفه");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(t: Tier) {
    await fetch("/api/admin/credit-tiers", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: t.id, isActive: !t.isActive }),
    });
    load();
  }

  async function remove(id: string) {
    if (!confirm("این تعرفه حذف بشه؟")) return;
    await fetch("/api/admin/credit-tiers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>تعرفه‌های خرید کردیت</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>پله‌های قابل‌خرید در صفحه «کیف پول کردیت» کاربران — از اینجا قابل مدیریت است.</p>
      </div>

      {/* Add form */}
      <div className="rounded-2xl p-5 space-y-3" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>افزودن تعرفه جدید</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <input placeholder="تعداد اعتبار" type="number" value={form.creditsAmount} onChange={(e) => setForm((p) => ({ ...p, creditsAmount: e.target.value }))}
            className="px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <input placeholder="قیمت (تومان)" type="number" value={form.priceToman} onChange={(e) => setForm((p) => ({ ...p, priceToman: e.target.value }))}
            className="px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <input placeholder="درصد تخفیف (نمایشی)" type="number" value={form.discountPercent} onChange={(e) => setForm((p) => ({ ...p, discountPercent: e.target.value }))}
            className="px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <select value={form.badge} onChange={(e) => setForm((p) => ({ ...p, badge: e.target.value }))}
            className="px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
            <option value="">بدون برچسب</option>
            <option value="best_value">پرفروش‌ترین</option>
            <option value="most_discount">بیشترین تخفیف</option>
          </select>
          <input placeholder="ترتیب نمایش" type="number" value={form.sortOrder} onChange={(e) => setForm((p) => ({ ...p, sortOrder: e.target.value }))}
            className="px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
        </div>
        <button onClick={addTier} disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50" style={{ background: "var(--primary)" }}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          افزودن
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--primary)" }} /></div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "var(--surface-1)", color: "var(--text-muted)" }}>
                <th className="text-right p-3">اعتبار</th>
                <th className="text-right p-3">قیمت (تومان)</th>
                <th className="text-right p-3">تخفیف</th>
                <th className="text-right p-3">برچسب</th>
                <th className="text-right p-3">وضعیت</th>
                <th className="text-right p-3"></th>
              </tr>
            </thead>
            <tbody>
              {tiers.map((t) => (
                <tr key={t.id} style={{ borderTop: "1px solid var(--border)", color: "var(--text-primary)" }}>
                  <td className="p-3">{t.creditsAmount.toLocaleString()}</td>
                  <td className="p-3">{t.priceToman.toLocaleString()}</td>
                  <td className="p-3">{t.discountPercent}٪</td>
                  <td className="p-3">{t.badge === "best_value" ? "پرفروش‌ترین" : t.badge === "most_discount" ? "بیشترین تخفیف" : "—"}</td>
                  <td className="p-3">
                    <button onClick={() => toggleActive(t)} className="px-2.5 py-1 rounded-full text-xs font-medium"
                      style={{ background: t.isActive ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", color: t.isActive ? "#22c55e" : "#ef4444" }}>
                      {t.isActive ? "فعال" : "غیرفعال"}
                    </button>
                  </td>
                  <td className="p-3">
                    <button onClick={() => remove(t.id)} style={{ color: "#ef4444" }}><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
              {tiers.length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center" style={{ color: "var(--text-muted)" }}>هنوز تعرفه‌ای ثبت نشده</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
