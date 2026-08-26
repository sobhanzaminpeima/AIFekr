"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Filter, ChevronLeft, ChevronRight, MoreVertical, Ban, Coins, UserCheck, Trash2, Loader2, Repeat, Plus, Sparkles, X } from "lucide-react";
import { toJalali, formatNumber } from "@/lib/utils/jalali";
import toast from "react-hot-toast";

interface User {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  plan: string;
  credits: number;
  isBlocked: boolean;
  createdAt: string;
  lastLoginAt?: string;
  _count: { conversations: number; payments: number };
}

const PLAN_BADGE: Record<string, { label: string; color: string }> = {
  FREE: { label: "رایگان", color: "#71717a" },
  BASIC: { label: "پایه", color: "#3b82f6" },
  PRO: { label: "حرفه‌ای", color: "#ea580c" },
  TEAM: { label: "تیمی", color: "#8b5cf6" },
};

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [actionUserId, setActionUserId] = useState<string | null>(null);
  const [planMenuUserId, setPlanMenuUserId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", email: "", phone: "", password: "", plan: "FREE" });
  const [addSaving, setAddSaving] = useState(false);

  // "Invite to AIfekr" — activates the trial here, then hands off to the
  // dedicated /admin/invites page (credentials, referral link, invite text).
  const [inviteTarget, setInviteTarget] = useState<{ userId: string | null; name: string } | null>(null);
  const [inviteForm, setInviteForm] = useState({ name: "", email: "", phone: "", trialDays: 7, realEstatePackage: true });
  const [inviteSaving, setInviteSaving] = useState(false);

  function openInviteForExisting(user: User) {
    setInviteTarget({ userId: user.id, name: user.name || user.email || user.phone || "" });
    setInviteForm({ name: "", email: "", phone: "", trialDays: 7, realEstatePackage: true });
    setActionUserId(null);
  }

  function openInviteForNew() {
    setInviteTarget({ userId: null, name: "" });
    setInviteForm({ name: "", email: "", phone: "", trialDays: 7, realEstatePackage: true });
  }

  async function activateInvite() {
    if (!inviteTarget) return;
    if (!inviteTarget.userId && !inviteForm.name.trim()) { toast.error("نام الزامی است"); return; }
    setInviteSaving(true);
    try {
      const body = inviteTarget.userId
        ? { userId: inviteTarget.userId, trialDays: inviteForm.trialDays, realEstatePackage: inviteForm.realEstatePackage }
        : { name: inviteForm.name, email: inviteForm.email || undefined, phone: inviteForm.phone || undefined, trialDays: inviteForm.trialDays, realEstatePackage: inviteForm.realEstatePackage };
      const res = await fetch("/api/admin/invites/activate-trial", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setInviteTarget(null);
      toast.success("تریال فعال شد");
      // Phase 3's dedicated invite page is the one place credentials/referral
      // link/invite text come together — send the admin straight there
      // instead of duplicating that display here.
      router.push(`/admin/invites?userId=${data.user.id}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "خطا در فعال‌سازی دعوت");
    } finally {
      setInviteSaving(false);
    }
  }

  useEffect(() => {
    if (!actionUserId) return;
    function onDocClick(e: MouseEvent) {
      if ((e.target as HTMLElement).closest("[data-dropdown-root]")) return;
      setActionUserId(null);
      setPlanMenuUserId(null);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [actionUserId]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: page.toString(), search, plan: planFilter });
      const res = await fetch(`/api/admin/users?${params}`);
      const data = await res.json();
      if (!res.ok) {
        setUsers([]);
        setTotal(0);
        setTotalPages(1);
        toast.error(data.error || "خطا در دریافت کاربران");
        return;
      }
      setUsers(data.users ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
    } finally {
      setLoading(false);
    }
  }, [page, search, planFilter]);

  async function addUser() {
    if (!addForm.name.trim()) return toast.error("نام الزامی است");
    if (!addForm.email && !addForm.phone) return toast.error("ایمیل یا موبایل الزامی است");
    if (addForm.password.length < 6) return toast.error("رمز عبور حداقل ۶ کاراکتر باشد");
    setAddSaving(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addForm),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "خطا در ایجاد کاربر");
        return;
      }
      toast.success("کاربر ایجاد شد");
      setShowAdd(false);
      setAddForm({ name: "", email: "", phone: "", password: "", plan: "FREE" });
      fetchUsers();
    } finally {
      setAddSaving(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(fetchUsers, 300);
    return () => clearTimeout(timeout);
  }, [fetchUsers]);

  async function toggleBlock(userId: string, isBlocked: boolean) {
    await fetch(`/api/admin/users/${userId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isBlocked: !isBlocked }),
    });
    toast.success(isBlocked ? "کاربر آزاد شد" : "کاربر مسدود شد");
    fetchUsers();
    setActionUserId(null);
  }

  async function addCredits(userId: string) {
    const amount = prompt("تعداد اعتبار برای افزودن:");
    if (!amount || isNaN(parseInt(amount))) return;
    const user = users.find((u) => u.id === userId);
    if (!user) return;
    await fetch(`/api/admin/users/${userId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credits: user.credits + parseInt(amount) }),
    });
    toast.success("اعتبار افزوده شد");
    fetchUsers();
    setActionUserId(null);
  }

  async function changePlan(userId: string, plan: string) {
    await fetch(`/api/admin/users/${userId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    toast.success(`پلن به «${PLAN_BADGE[plan].label}» تغییر کرد`);
    fetchUsers();
    setPlanMenuUserId(null);
    setActionUserId(null);
  }

  async function deleteUser(userId: string) {
    if (!confirm("آیا مطمئن هستید؟ این عمل برگشت‌ناپذیر است.")) return;
    await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
    toast.success("کاربر حذف شد");
    fetchUsers();
    setActionUserId(null);
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>مدیریت کاربران</h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{formatNumber(total)} کاربر</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={openInviteForNew} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: "linear-gradient(135deg, #F5821F, #F2701A)" }}>
            <Sparkles className="w-4 h-4" /> دعوت جدید
          </button>
          <button onClick={() => router.push("/admin/invites/manage")} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
            مدیریت دعوتنامه‌ها
          </button>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: "var(--primary)" }}>
            <Plus className="w-4 h-4" /> افزودن کاربر
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-48 px-4 py-2.5 rounded-xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <Search className="w-4 h-4 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="جستجو بر اساس نام، ایمیل یا موبایل..."
            className="flex-1 text-sm bg-transparent outline-none"
            style={{ color: "var(--text-primary)" }}
          />
        </div>
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <Filter className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
          <select
            value={planFilter}
            onChange={(e) => { setPlanFilter(e.target.value); setPage(1); }}
            className="text-sm bg-transparent outline-none"
            style={{ color: "var(--text-primary)" }}
          >
            <option value="all">همه پلن‌ها</option>
            <option value="FREE">رایگان</option>
            <option value="BASIC">پایه</option>
            <option value="PRO">حرفه‌ای</option>
            <option value="TEAM">تیمی</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--primary)" }} />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["کاربر", "پلن", "اعتبار", "گفتگوها", "پرداخت‌ها", "تاریخ ثبت", "وضعیت", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-right font-medium" style={{ color: "var(--text-secondary)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((user, idx) => {
                const badge = PLAN_BADGE[user.plan];
                const openUp = idx >= users.length - 3;
                return (
                  <tr key={user.id} style={{ borderBottom: "1px solid var(--border)" }} className="hover:bg-white/2 transition-colors">
                    <td className="px-4 py-3 cursor-pointer" onClick={() => router.push(`/admin/users/${user.id}`)}>
                      <div>
                        <div className="font-medium" style={{ color: "var(--text-primary)" }}>{user.name || "بدون نام"}</div>
                        <div className="text-xs" style={{ color: "var(--text-muted)" }}>{user.email || user.phone || "—"}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: badge.color + "22", color: badge.color }}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3" style={{ color: "var(--text-primary)" }}>{formatNumber(user.credits)}</td>
                    <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{user._count.conversations}</td>
                    <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{user._count.payments}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--text-muted)" }}>{toJalali(user.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs" style={{
                        background: user.isBlocked ? "rgba(239,68,68,0.1)" : "rgba(34,197,94,0.1)",
                        color: user.isBlocked ? "var(--danger)" : "var(--success)",
                      }}>
                        {user.isBlocked ? "مسدود" : "فعال"}
                      </span>
                    </td>
                    <td className="px-4 py-3 relative" data-dropdown-root>
                      <button onClick={() => setActionUserId(actionUserId === user.id ? null : user.id)} className="p-1 rounded-lg" style={{ color: "var(--text-muted)" }}>
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {actionUserId === user.id && planMenuUserId !== user.id && (
                        <div className={`absolute left-0 z-50 w-44 rounded-xl overflow-hidden shadow-xl ${openUp ? "bottom-full mb-1" : "top-full mt-1"}`} style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                          <ActionItem icon={Sparkles} label="فعال‌سازی دعوت Pro" onClick={() => openInviteForExisting(user)} />
                          <ActionItem icon={user.isBlocked ? UserCheck : Ban} label={user.isBlocked ? "آزادسازی" : "مسدودسازی"} onClick={() => toggleBlock(user.id, user.isBlocked)} danger={!user.isBlocked} />
                          <ActionItem icon={Coins} label="افزایش اعتبار" onClick={() => addCredits(user.id)} />
                          <ActionItem icon={Repeat} label="تغییر پلن" onClick={() => setPlanMenuUserId(user.id)} />
                          <ActionItem icon={Trash2} label="حذف کاربر" onClick={() => deleteUser(user.id)} danger />
                        </div>
                      )}
                      {actionUserId === user.id && planMenuUserId === user.id && (
                        <div className={`absolute left-0 z-50 w-44 rounded-xl overflow-hidden shadow-xl ${openUp ? "bottom-full mb-1" : "top-full mt-1"}`} style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                          <div className="px-3 py-2 text-xs font-medium" style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>
                            انتخاب پلن جدید
                          </div>
                          {Object.keys(PLAN_BADGE).map((p) => (
                            <button key={p} onClick={() => changePlan(user.id, p)}
                              disabled={p === user.plan}
                              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-right transition-all hover:bg-white/5 disabled:opacity-40"
                              style={{ color: PLAN_BADGE[p].color }}>
                              {PLAN_BADGE[p].label}{p === user.plan ? " (فعلی)" : ""}
                            </button>
                          ))}
                          <ActionItem icon={ChevronRight} label="بازگشت" onClick={() => setPlanMenuUserId(null)} />
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm" style={{ color: "var(--text-muted)" }}>
            صفحه {page} از {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-xl disabled:opacity-40"
              style={{ background: "var(--surface-2)" }}
            >
              <ChevronRight className="w-4 h-4" style={{ color: "var(--text-primary)" }} />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 rounded-xl disabled:opacity-40"
              style={{ background: "var(--surface-2)" }}
            >
              <ChevronLeft className="w-4 h-4" style={{ color: "var(--text-primary)" }} />
            </button>
          </div>
        </div>
      )}

      {/* Add user modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <h2 className="font-bold" style={{ color: "var(--text-primary)" }}>افزودن کاربر جدید</h2>
            <div>
              <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>نام</label>
              <input value={addForm.name} onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>ایمیل</label>
                <input value={addForm.email} onChange={(e) => setAddForm((p) => ({ ...p, email: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>موبایل</label>
                <input value={addForm.phone} onChange={(e) => setAddForm((p) => ({ ...p, phone: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
              </div>
            </div>
            <div>
              <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>رمز عبور</label>
              <input type="password" value={addForm.password} onChange={(e) => setAddForm((p) => ({ ...p, password: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            </div>
            <div>
              <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>پلن</label>
              <select value={addForm.plan} onChange={(e) => setAddForm((p) => ({ ...p, plan: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                {Object.keys(PLAN_BADGE).map((p) => <option key={p} value={p}>{PLAN_BADGE[p].label}</option>)}
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={addUser} disabled={addSaving} className="flex-1 py-2 rounded-xl font-semibold text-sm text-white disabled:opacity-50" style={{ background: "var(--primary)" }}>
                {addSaving ? "در حال ذخیره..." : "افزودن"}
              </button>
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2 rounded-xl text-sm" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>انصراف</button>
            </div>
          </div>
        </div>
      )}

      {/* Invite-to-AIfekr: trial activation form */}
      {inviteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                <Sparkles className="w-4 h-4" style={{ color: "#F5821F" }} /> فعال‌سازی دعوت Pro
              </h2>
              <button onClick={() => setInviteTarget(null)}><X className="w-4 h-4" style={{ color: "var(--text-muted)" }} /></button>
            </div>

            {inviteTarget.userId ? (
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>برای کاربر: <strong>{inviteTarget.name}</strong></p>
            ) : (
              <>
                <div>
                  <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>نام کاربر جدید</label>
                  <input value={inviteForm.name} onChange={(e) => setInviteForm((p) => ({ ...p, name: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>ایمیل</label>
                    <input value={inviteForm.email} onChange={(e) => setInviteForm((p) => ({ ...p, email: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                  </div>
                  <div>
                    <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>موبایل</label>
                    <input value={inviteForm.phone} onChange={(e) => setInviteForm((p) => ({ ...p, phone: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                  </div>
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>مدت تریال (روز)</label>
                <input type="number" min={1} max={90} value={inviteForm.trialDays} onChange={(e) => setInviteForm((p) => ({ ...p, trialDays: Number(e.target.value) || 7 }))}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
              </div>
              <div className="flex items-end pb-2.5">
                <label className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                  <input type="checkbox" checked={inviteForm.realEstatePackage} onChange={(e) => setInviteForm((p) => ({ ...p, realEstatePackage: e.target.checked }))} />
                  پکیج املاک کامل
                </label>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={activateInvite} disabled={inviteSaving} className="flex-1 py-2 rounded-xl font-semibold text-sm text-white disabled:opacity-50" style={{ background: "linear-gradient(135deg, #F5821F, #F2701A)" }}>
                {inviteSaving ? "در حال فعال‌سازی..." : "فعال‌سازی"}
              </button>
              <button onClick={() => setInviteTarget(null)} className="flex-1 py-2 rounded-xl text-sm" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>انصراف</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function ActionItem({ icon: Icon, label, onClick, danger }: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-right transition-all hover:bg-white/5"
      style={{ color: danger ? "var(--danger)" : "var(--text-secondary)" }}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}
