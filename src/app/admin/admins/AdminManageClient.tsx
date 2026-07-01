"use client";

import { useState } from "react";
import { Shield, Plus, Trash2, UserCog, Clock, ChevronDown } from "lucide-react";
import toast from "react-hot-toast";

const ROLES = [
  { value: "SUPER_ADMIN", label: "سوپر ادمین", color: "#ef4444", desc: "دسترسی کامل به همه بخش‌ها" },
  { value: "ADMIN", label: "ادمین", color: "#ea580c", desc: "دسترسی به اکثر بخش‌ها" },
  { value: "MODERATOR", label: "مدیر محتوا", color: "#3b82f6", desc: "مدیریت چت و محتوا" },
];

type Admin = { id: string; name: string | null; email: string | null; phone: string | null; role: string; createdAt: Date; lastLoginAt: Date | null; isBlocked: boolean };
type User = { id: string; name: string | null; email: string | null; phone: string | null };

export default function AdminManageClient({ admins: initial, allUsers }: { admins: Admin[]; allUsers: User[] }) {
  const [admins, setAdmins] = useState(initial);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedRole, setSelectedRole] = useState("ADMIN");
  const [saving, setSaving] = useState(false);

  const roleInfo = (role: string) => ROLES.find(r => r.value === role) || { label: role, color: "#71717a", desc: "" };

  async function handleAdd() {
    if (!selectedUser) return toast.error("کاربر را انتخاب کنید");
    setSaving(true);
    const res = await fetch("/api/admin/set-role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: selectedUser, role: selectedRole }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("نقش تعیین شد");
      setShowAdd(false);
      window.location.reload();
    } else {
      toast.error("خطا در تعیین نقش");
    }
  }

  async function handleRemove(id: string) {
    if (!confirm("این ادمین حذف شود؟")) return;
    const res = await fetch("/api/admin/set-role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: id, role: "USER" }),
    });
    if (res.ok) {
      setAdmins(a => a.filter(x => x.id !== id));
      toast.success("نقش به کاربر عادی تغییر کرد");
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>مدیران سیستم</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>افزودن و مدیریت ادمین‌ها</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: "var(--primary)" }}>
          <Plus className="w-4 h-4" /> افزودن ادمین
        </button>
      </div>

      {/* Role cards */}
      <div className="grid grid-cols-3 gap-4">
        {ROLES.map(r => (
          <div key={r.value} className="p-4 rounded-2xl" style={{ background: "var(--surface-1)", border: `1px solid ${r.color}30` }}>
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4" style={{ color: r.color }} />
              <span className="font-semibold text-sm" style={{ color: r.color }}>{r.label}</span>
            </div>
            <div className="text-2xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
              {admins.filter(a => a.role === r.value).length}
            </div>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>{r.desc}</div>
          </div>
        ))}
      </div>

      {/* Admins list */}
      <div className="space-y-2">
        {admins.map(a => {
          const ri = roleInfo(a.role);
          return (
            <div key={a.id} className="p-4 rounded-2xl flex items-center gap-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${ri.color}20` }}>
                <UserCog className="w-5 h-5" style={{ color: ri.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>{a.name || "بدون نام"}</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: `${ri.color}20`, color: ri.color }}>{ri.label}</span>
                </div>
                <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{a.phone || a.email || "—"}</div>
              </div>
              <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-muted)" }}>
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleDateString("fa-IR") : "ورود نداشته"}
                </div>
              </div>
              <button onClick={() => handleRemove(a.id)} className="p-1.5 rounded-lg" style={{ color: "#ef4444" }}>
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        })}
        {admins.length === 0 && (
          <div className="text-center py-12" style={{ color: "var(--text-muted)" }}>ادمینی یافت نشد</div>
        )}
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <h2 className="font-bold" style={{ color: "var(--text-primary)" }}>افزودن ادمین جدید</h2>
            <div>
              <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>انتخاب کاربر</label>
              <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                <option value="">— کاربر را انتخاب کنید —</option>
                {allUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.name || u.phone || u.email || u.id}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm mb-2" style={{ color: "var(--text-secondary)" }}>نقش</label>
              <div className="space-y-2">
                {ROLES.map(r => (
                  <button key={r.value} onClick={() => setSelectedRole(r.value)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-right transition-all"
                    style={{ background: selectedRole === r.value ? `${r.color}15` : "var(--surface-2)", border: `1px solid ${selectedRole === r.value ? r.color : "var(--border)"}` }}>
                    <Shield className="w-4 h-4 flex-shrink-0" style={{ color: r.color }} />
                    <div>
                      <div className="font-medium" style={{ color: r.color }}>{r.label}</div>
                      <div className="text-xs" style={{ color: "var(--text-muted)" }}>{r.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={handleAdd} disabled={saving} className="flex-1 py-2 rounded-xl font-semibold text-sm text-white disabled:opacity-50" style={{ background: "var(--primary)" }}>
                {saving ? "در حال ذخیره..." : "افزودن"}
              </button>
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2 rounded-xl text-sm" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>انصراف</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
