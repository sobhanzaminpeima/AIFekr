"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { Contact, Plus, Search, Phone, Mail, Building2, Edit2, Trash2, Tag, DollarSign, Clock } from "lucide-react";
import toast from "react-hot-toast";

const STATUS_OPTIONS = [
  { value: "lead", label: "لید", color: "#71717a" },
  { value: "prospect", label: "احتمالی", color: "#3b82f6" },
  { value: "active", label: "فعال", color: "#10b981" },
  { value: "churned", label: "از دست رفته", color: "#ef4444" },
  { value: "vip", label: "VIP", color: "#f59e0b" },
];

const SOURCE_OPTIONS = ["organic", "referral", "social", "ads", "direct"];

const INITIAL_CONTACTS = [
  { id: "1", name: "علی احمدی", phone: "09121234567", email: "ali@example.com", company: "شرکت آلفا", status: "active", source: "organic", plan: "PRO", totalSpent: 1050000, notes: "مشتری وفادار", tags: "vip,tech", lastContact: new Date().toISOString(), createdAt: new Date().toISOString() },
  { id: "2", name: "مریم کریمی", phone: "09351234567", email: "maryam@example.com", company: "", status: "prospect", source: "social", plan: "BASIC", totalSpent: 150000, notes: "", tags: "startup", lastContact: new Date().toISOString(), createdAt: new Date().toISOString() },
  { id: "3", name: "رضا محمدی", phone: "09101234567", email: "", company: "فناوری بتا", status: "lead", source: "referral", plan: "FREE", totalSpent: 0, notes: "علاقه‌مند به Pro", tags: "", lastContact: null as any, createdAt: new Date().toISOString() },
];

type Contact = typeof INITIAL_CONTACTS[0];
const emptyForm = { name: "", phone: "", email: "", company: "", status: "lead", source: "organic", plan: "", notes: "", tags: "" };

export default function CrmPage() {
  const [contacts, setContacts] = useState<Contact[]>(INITIAL_CONTACTS);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [selected, setSelected] = useState<Contact | null>(null);

  function openAdd() { setEditing(null); setForm(emptyForm); setShowForm(true); }
  function openEdit(c: Contact) { setEditing(c); setForm({ name: c.name, phone: c.phone || "", email: c.email || "", company: c.company || "", status: c.status, source: c.source, plan: c.plan || "", notes: c.notes || "", tags: c.tags || "" }); setShowForm(true); }

  function handleSave() {
    if (!form.name) return toast.error("نام الزامی است");
    if (editing) {
      setContacts(cs => cs.map(c => c.id === editing.id ? { ...c, ...form } : c));
      toast.success("مخاطب آپدیت شد");
    } else {
      setContacts(cs => [...cs, { ...form, id: Date.now().toString(), totalSpent: 0, lastContact: null as any, createdAt: new Date().toISOString() }]);
      toast.success("مخاطب اضافه شد");
    }
    setShowForm(false);
  }

  function deleteContact(id: string) { if (!confirm("حذف شود؟")) return; setContacts(cs => cs.filter(c => c.id !== id)); if (selected?.id === id) setSelected(null); toast.success("حذف شد"); }

  const filtered = contacts.filter(c => {
    if (filterStatus !== "all" && c.status !== filterStatus) return false;
    if (search && !c.name.includes(search) && !(c.phone || "").includes(search) && !(c.email || "").includes(search)) return false;
    return true;
  });

  const statusInfo = (s: string) => STATUS_OPTIONS.find(o => o.value === s) || { label: s, color: "#71717a" };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>سیستم CRM</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>مدیریت مشتریان و سرنخ‌های فروش</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: "var(--primary)" }}>
          <Plus className="w-4 h-4" /> افزودن مخاطب
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {STATUS_OPTIONS.map(s => (
          <button key={s.value} onClick={() => setFilterStatus(filterStatus === s.value ? "all" : s.value)}
            className="p-3 rounded-2xl text-right transition-all"
            style={{ background: "var(--surface-1)", border: `1px solid ${filterStatus === s.value ? s.color : "var(--border)"}` }}>
            <div className="text-xl font-bold" style={{ color: s.color }}>{contacts.filter(c => c.status === s.value).length}</div>
            <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{s.label}</div>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="جستجو بر اساس نام، تلفن، ایمیل..."
          className="w-full pr-9 pl-3 py-2 rounded-xl text-sm outline-none"
          style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
      </div>

      {/* Split view */}
      <div className="flex gap-4" style={{ minHeight: "400px" }}>
        {/* List */}
        <div className="flex-1 space-y-2 overflow-y-auto" style={{ maxHeight: "600px" }}>
          {filtered.length === 0 && <div className="text-center py-12" style={{ color: "var(--text-muted)" }}>مخاطبی یافت نشد</div>}
          {filtered.map(c => {
            const si = statusInfo(c.status);
            return (
              <div key={c.id} onClick={() => setSelected(c === selected ? null : c)}
                className="p-3 rounded-xl cursor-pointer transition-all"
                style={{ background: selected?.id === c.id ? `${si.color}15` : "var(--surface-1)", border: `1px solid ${selected?.id === c.id ? si.color : "var(--border)"}` }}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-bold text-white" style={{ background: si.color }}>
                      {c.name[0]}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate" style={{ color: "var(--text-primary)" }}>{c.name}</div>
                      <div className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{c.phone || c.email || "—"}</div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0" style={{ background: `${si.color}20`, color: si.color }}>{si.label}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="w-80 flex-shrink-0 rounded-2xl p-5 space-y-4 overflow-y-auto" style={{ background: "var(--surface-1)", border: "1px solid var(--border)", maxHeight: "600px" }}>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-bold" style={{ color: "var(--text-primary)" }}>{selected.name}</h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: `${statusInfo(selected.status).color}20`, color: statusInfo(selected.status).color }}>{statusInfo(selected.status).label}</span>
              </div>
              <div className="flex gap-1">
                <button onClick={() => openEdit(selected)} className="p-1.5 rounded-lg" style={{ color: "var(--text-muted)" }}><Edit2 className="w-4 h-4" /></button>
                <button onClick={() => deleteContact(selected.id)} className="p-1.5 rounded-lg" style={{ color: "#ef4444" }}><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>

            <div className="space-y-2">
              {[
                { icon: Phone, label: selected.phone || "—" },
                { icon: Mail, label: selected.email || "—" },
                { icon: Building2, label: selected.company || "—" },
                { icon: DollarSign, label: (selected.totalSpent / 10).toLocaleString("fa-IR") + " ت" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <item.icon className="w-4 h-4 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
                  <span style={{ color: "var(--text-secondary)" }}>{item.label}</span>
                </div>
              ))}
            </div>

            {selected.tags && (
              <div className="flex flex-wrap gap-1">
                {selected.tags.split(",").filter(Boolean).map(tag => (
                  <span key={tag} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs" style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>
                    <Tag className="w-3 h-3" />{tag.trim()}
                  </span>
                ))}
              </div>
            )}

            {selected.notes && (
              <div className="p-3 rounded-xl text-sm" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
                {selected.notes}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <a href={`tel:${selected.phone}`} className="flex-1 py-2 rounded-xl text-xs text-center font-medium" style={{ background: "#10b98120", color: "#10b981" }}>
                تماس
              </a>
              <a href={`mailto:${selected.email}`} className="flex-1 py-2 rounded-xl text-xs text-center font-medium" style={{ background: "#3b82f620", color: "#3b82f6" }}>
                ایمیل
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div className="w-full max-w-lg rounded-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <h2 className="font-bold" style={{ color: "var(--text-primary)" }}>{editing ? "ویرایش مخاطب" : "افزودن مخاطب جدید"}</h2>
            <div className="grid grid-cols-2 gap-3">
              {[{ label: "نام", key: "name" }, { label: "تلفن", key: "phone" }, { label: "ایمیل", key: "email" }, { label: "شرکت", key: "company" }].map(f => (
                <div key={f.key}>
                  <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>{f.label}</label>
                  <input value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>وضعیت</label>
                <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                  {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>منبع</label>
                <select value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                  {SOURCE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>تگ‌ها (با کاما جدا کنید)</label>
              <input value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} placeholder="vip, tech, startup"
                className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            </div>
            <div>
              <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>یادداشت</label>
              <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={3}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
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
