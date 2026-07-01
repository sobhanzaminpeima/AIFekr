"use client";

import { useEffect, useState, useCallback } from "react";
import { Search, Filter, ChevronLeft, ChevronRight, MoreVertical, Ban, Coins, UserCheck, Trash2, Loader2 } from "lucide-react";
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
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [actionUserId, setActionUserId] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: page.toString(), search, plan: planFilter });
      const res = await fetch(`/api/admin/users?${params}`);
      const data = await res.json();
      setUsers(data.users);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } finally {
      setLoading(false);
    }
  }, [page, search, planFilter]);

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
      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
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
              {users.map((user) => {
                const badge = PLAN_BADGE[user.plan];
                return (
                  <tr key={user.id} style={{ borderBottom: "1px solid var(--border)" }} className="hover:bg-white/2 transition-colors">
                    <td className="px-4 py-3">
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
                    <td className="px-4 py-3 relative">
                      <button onClick={() => setActionUserId(actionUserId === user.id ? null : user.id)} className="p-1 rounded-lg" style={{ color: "var(--text-muted)" }}>
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {actionUserId === user.id && (
                        <div className="absolute left-0 top-full z-50 mt-1 w-44 rounded-xl overflow-hidden shadow-xl" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                          <ActionItem icon={user.isBlocked ? UserCheck : Ban} label={user.isBlocked ? "آزادسازی" : "مسدودسازی"} onClick={() => toggleBlock(user.id, user.isBlocked)} danger={!user.isBlocked} />
                          <ActionItem icon={Coins} label="افزایش اعتبار" onClick={() => addCredits(user.id)} />
                          <ActionItem icon={Trash2} label="حذف کاربر" onClick={() => deleteUser(user.id)} danger />
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
