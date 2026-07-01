"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { Cpu, Plus, Edit2, Trash2, ToggleLeft, ToggleRight, Star, StarOff, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";

const DEFAULT_MODELS = [
  { id: "1", name: "Claude Haiku 4.5", provider: "anthropic", modelId: "claude-haiku-4-5-20251001", description: "سریع‌ترین مدل برای کارهای روزمره", maxTokens: 4096, creditCost: 1, isActive: true, isPrimary: false },
  { id: "2", name: "Claude Sonnet 4.6", provider: "anthropic", modelId: "claude-sonnet-4-6", description: "بهترین تعادل بین سرعت و کیفیت", maxTokens: 8192, creditCost: 3, isActive: true, isPrimary: true },
  { id: "3", name: "Claude Opus 4.8", provider: "anthropic", modelId: "claude-opus-4-8", description: "قدرتمندترین مدل برای کارهای پیچیده", maxTokens: 16384, creditCost: 10, isActive: true, isPrimary: false },
];

type Model = typeof DEFAULT_MODELS[0];

export default function LlmPage() {
  const [models, setModels] = useState<Model[]>(DEFAULT_MODELS);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Model | null>(null);
  const [form, setForm] = useState({ name: "", provider: "anthropic", modelId: "", description: "", maxTokens: 4096, creditCost: 1 });

  function openAdd() { setEditing(null); setForm({ name: "", provider: "anthropic", modelId: "", description: "", maxTokens: 4096, creditCost: 1 }); setShowForm(true); }
  function openEdit(m: Model) { setEditing(m); setForm({ name: m.name, provider: m.provider, modelId: m.modelId, description: m.description || "", maxTokens: m.maxTokens, creditCost: m.creditCost }); setShowForm(true); }

  function handleSave() {
    if (!form.name || !form.modelId) return toast.error("نام و Model ID الزامی است");
    if (editing) {
      setModels(ms => ms.map(m => m.id === editing.id ? { ...m, ...form } : m));
      toast.success("مدل آپدیت شد");
    } else {
      setModels(ms => [...ms, { ...form, id: Date.now().toString(), isActive: true, isPrimary: false }]);
      toast.success("مدل اضافه شد");
    }
    setShowForm(false);
  }

  function toggleActive(id: string) {
    setModels(ms => ms.map(m => m.id === id ? { ...m, isActive: !m.isActive } : m));
  }
  function setPrimary(id: string) {
    setModels(ms => ms.map(m => ({ ...m, isPrimary: m.id === id })));
    toast.success("مدل پیش‌فرض تغییر کرد");
  }
  function deleteModel(id: string) {
    if (!confirm("مطمئنی؟")) return;
    setModels(ms => ms.filter(m => m.id !== id));
    toast.success("مدل حذف شد");
  }

  const providerColors: Record<string, string> = { anthropic: "#ea580c", openai: "#10b981", google: "#3b82f6" };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>مدیریت LLM</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>مدیریت مدل‌های هوش مصنوعی و تنظیمات آن‌ها</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: "var(--primary)" }}>
          <Plus className="w-4 h-4" /> افزودن مدل
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "کل مدل‌ها", value: models.length, color: "#3b82f6" },
          { label: "فعال", value: models.filter(m => m.isActive).length, color: "#10b981" },
          { label: "غیرفعال", value: models.filter(m => !m.isActive).length, color: "#ef4444" },
        ].map(s => (
          <div key={s.label} className="p-4 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Models list */}
      <div className="space-y-3">
        {models.map(m => (
          <div key={m.id} className="p-4 rounded-2xl flex items-center gap-4" style={{ background: "var(--surface-1)", border: `1px solid ${m.isPrimary ? "var(--primary)" : "var(--border)"}` }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${providerColors[m.provider]}20` }}>
              <Cpu className="w-5 h-5" style={{ color: providerColors[m.provider] }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{m.name}</span>
                {m.isPrimary && <span className="px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{ background: "var(--primary)" }}>پیش‌فرض</span>}
                {!m.isActive && <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: "#ef444420", color: "#ef4444" }}>غیرفعال</span>}
              </div>
              <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{m.modelId} · {m.creditCost} اعتبار · {m.maxTokens.toLocaleString()} توکن</div>
              {m.description && <div className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>{m.description}</div>}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={() => setPrimary(m.id)} title="تنظیم به عنوان پیش‌فرض" className="p-1.5 rounded-lg" style={{ color: m.isPrimary ? "#f59e0b" : "var(--text-muted)" }}>
                {m.isPrimary ? <Star className="w-4 h-4 fill-current" /> : <StarOff className="w-4 h-4" />}
              </button>
              <button onClick={() => toggleActive(m.id)} className="p-1.5 rounded-lg" style={{ color: m.isActive ? "#10b981" : "#ef4444" }}>
                {m.isActive ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
              </button>
              <button onClick={() => openEdit(m)} className="p-1.5 rounded-lg" style={{ color: "var(--text-muted)" }}><Edit2 className="w-4 h-4" /></button>
              <button onClick={() => deleteModel(m.id)} className="p-1.5 rounded-lg" style={{ color: "#ef4444" }}><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <h2 className="font-bold" style={{ color: "var(--text-primary)" }}>{editing ? "ویرایش مدل" : "افزودن مدل جدید"}</h2>
            {[
              { label: "نام مدل", key: "name", placeholder: "مثال: Claude Haiku" },
              { label: "Model ID", key: "modelId", placeholder: "مثال: claude-haiku-4-5-20251001" },
              { label: "توضیح (اختیاری)", key: "description", placeholder: "" },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>{f.label}</label>
                <input value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-3">
              {[{ label: "هزینه اعتبار", key: "creditCost" }, { label: "حداکثر توکن", key: "maxTokens" }].map(f => (
                <div key={f.key}>
                  <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>{f.label}</label>
                  <input type="number" value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: Number(e.target.value) }))}
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                </div>
              ))}
            </div>
            <div>
              <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Provider</label>
              <select value={form.provider} onChange={e => setForm(p => ({ ...p, provider: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                <option value="anthropic">Anthropic</option>
                <option value="openai">OpenAI</option>
                <option value="google">Google</option>
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
