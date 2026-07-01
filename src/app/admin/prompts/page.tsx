"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { HelpCircle, Plus, Edit2, Trash2, GripVertical, ToggleLeft, ToggleRight } from "lucide-react";
import toast from "react-hot-toast";

const CATEGORIES = ["عمومی", "کسب‌وکار", "آموزش", "سلامت", "فناوری", "هنر و خلاقیت", "سفر", "مالی"];

const INITIAL_PROMPTS = [
  { id: "1", title: "ایده کسب‌وکار آنلاین", content: "یک ایده کسب‌وکار آنلاین با سرمایه کم برای من پیشنهاد بده", category: "کسب‌وکار", isActive: true, sortOrder: 1, usedCount: 145 },
  { id: "2", title: "توضیح ساده مفهوم", content: "این مفهوم را به زبان ساده برای من توضیح بده: [موضوع]", category: "آموزش", isActive: true, sortOrder: 2, usedCount: 89 },
  { id: "3", title: "برنامه غذایی سالم", content: "یک برنامه غذایی سالم هفتگی برای من بنویس", category: "سلامت", isActive: true, sortOrder: 3, usedCount: 72 },
  { id: "4", title: "کد نویسی پایتون", content: "یک اسکریپت پایتون برای [کار] برایم بنویس", category: "فناوری", isActive: true, sortOrder: 4, usedCount: 61 },
];

type Prompt = typeof INITIAL_PROMPTS[0];

export default function PromptsPage() {
  const [prompts, setPrompts] = useState<Prompt[]>(INITIAL_PROMPTS);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Prompt | null>(null);
  const [filter, setFilter] = useState("همه");
  const [form, setForm] = useState({ title: "", content: "", category: "عمومی" });

  function openAdd() { setEditing(null); setForm({ title: "", content: "", category: "عمومی" }); setShowForm(true); }
  function openEdit(p: Prompt) { setEditing(p); setForm({ title: p.title, content: p.content, category: p.category }); setShowForm(true); }

  function handleSave() {
    if (!form.title || !form.content) return toast.error("عنوان و محتوا الزامی است");
    if (editing) {
      setPrompts(ps => ps.map(p => p.id === editing.id ? { ...p, ...form } : p));
      toast.success("سوال آپدیت شد");
    } else {
      setPrompts(ps => [...ps, { ...form, id: Date.now().toString(), isActive: true, sortOrder: ps.length + 1, usedCount: 0 }]);
      toast.success("سوال اضافه شد");
    }
    setShowForm(false);
  }

  function toggleActive(id: string) { setPrompts(ps => ps.map(p => p.id === id ? { ...p, isActive: !p.isActive } : p)); }
  function deletePrompt(id: string) { if (!confirm("حذف شود؟")) return; setPrompts(ps => ps.filter(p => p.id !== id)); toast.success("حذف شد"); }

  const filtered = filter === "همه" ? prompts : prompts.filter(p => p.category === filter);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>سوالات آماده</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>مدیریت پیشنهادات و سوالات پیش‌فرض چت</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: "var(--primary)" }}>
          <Plus className="w-4 h-4" /> افزودن سوال
        </button>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap">
        {["همه", ...CATEGORIES].map(c => (
          <button key={c} onClick={() => setFilter(c)}
            className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
            style={{ background: filter === c ? "var(--primary)" : "var(--surface-1)", color: filter === c ? "white" : "var(--text-secondary)", border: "1px solid var(--border)" }}>
            {c}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "کل سوالات", value: prompts.length, color: "#3b82f6" },
          { label: "فعال", value: prompts.filter(p => p.isActive).length, color: "#10b981" },
          { label: "کل استفاده", value: prompts.reduce((s, p) => s + p.usedCount, 0), color: "#f59e0b" },
        ].map(s => (
          <div key={s.label} className="p-4 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value.toLocaleString("fa-IR")}</div>
            <div className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* List */}
      <div className="space-y-2">
        {filtered.map(p => (
          <div key={p.id} className="p-4 rounded-2xl flex items-start gap-3" style={{ background: "var(--surface-1)", border: "1px solid var(--border)", opacity: p.isActive ? 1 : 0.6 }}>
            <GripVertical className="w-4 h-4 mt-0.5 flex-shrink-0 cursor-grab" style={{ color: "var(--text-muted)" }} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>{p.title}</span>
                <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>{p.category}</span>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>{p.usedCount} بار استفاده</span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{p.content}</p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button onClick={() => toggleActive(p.id)} className="p-1.5 rounded-lg" style={{ color: p.isActive ? "#10b981" : "#ef4444" }}>
                {p.isActive ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
              </button>
              <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg" style={{ color: "var(--text-muted)" }}><Edit2 className="w-4 h-4" /></button>
              <button onClick={() => deletePrompt(p.id)} className="p-1.5 rounded-lg" style={{ color: "#ef4444" }}><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div className="w-full max-w-lg rounded-2xl p-6 space-y-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <h2 className="font-bold" style={{ color: "var(--text-primary)" }}>{editing ? "ویرایش سوال" : "افزودن سوال جدید"}</h2>
            <div>
              <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>عنوان</label>
              <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="عنوان کوتاه و گویا"
                className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            </div>
            <div>
              <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>محتوای پیام</label>
              <textarea value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} rows={4} placeholder="متن پیام که به چت ارسال می‌شود..."
                className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            </div>
            <div>
              <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>دسته‌بندی</label>
              <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={handleSave} className="flex-1 py-2 rounded-xl font-semibold text-sm text-white" style={{ background: "var(--primary)" }}>ذخیره</button>
              <button onClick={() => setShowForm(false)} className="flex-1 py-2 rounded-xl text-sm" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>انصراف</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
