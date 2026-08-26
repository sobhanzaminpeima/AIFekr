"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowRight, ExternalLink, Sparkles } from "lucide-react";

/**
 * "مدیریت دعوتنامه‌ها" — lists every user ever invited through the admin
 * "Invite to AIfekr" tool, so an admin can find a past invite, see its
 * trial/package status, and jump back into /admin/invites?userId=... to
 * regenerate a password, re-download the card, or view saved cards.
 * Read-only list; all mutating actions still live on the invite page itself.
 */

interface InviteRow {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  referralCode: string | null;
  trialPlan: string | null;
  trialStartsAt: string | null;
  trialEndsAt: string | null;
  realEstatePackage: boolean;
  mustChangePassword: boolean;
  invitedByAdminName: string | null;
  invitedAt: string | null;
  plan: string | null;
  trialActive: boolean;
  cardCount: number;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fa-IR");
}

export default function InviteManagePage() {
  const router = useRouter();
  const [items, setItems] = useState<InviteRow[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (query: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/invites/list?q=${encodeURIComponent(query)}`);
      if (res.status === 401) {
        router.push(`/login?redirect=${encodeURIComponent("/admin/invites/manage")}`);
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطا در دریافت لیست");
      setItems(data.items || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا در دریافت لیست");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load("");
  }, [load]);

  return (
    <div className="max-w-6xl mx-auto p-6" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-orange-500" />
            مدیریت دعوتنامه‌ها
          </h1>
          <p className="text-sm text-gray-500 mt-1">لیست همه کاربرانی که از طریق ابزار «دعوت به AIfekr» دعوت شده‌اند</p>
        </div>
        <button
          onClick={() => router.push("/admin/invites")}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 text-white hover:bg-orange-600"
        >
          دعوتنامه جدید
          <ArrowRight className="w-4 h-4 rotate-180" />
        </button>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load(q)}
            placeholder="جستجو با نام، ایمیل، موبایل یا کد رفرال..."
            className="w-full pr-9 pl-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm"
          />
        </div>
        <button
          onClick={() => load(q)}
          className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm"
        >
          جستجو
        </button>
      </div>

      {error && <div className="text-red-500 text-sm mb-4">{error}</div>}

      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500">
            <tr>
              <th className="text-right p-3 font-medium">کاربر</th>
              <th className="text-right p-3 font-medium">وضعیت پلن</th>
              <th className="text-right p-3 font-medium">پکیج املاک</th>
              <th className="text-right p-3 font-medium">کد رفرال</th>
              <th className="text-right p-3 font-medium">تغییر پسورد؟</th>
              <th className="text-right p-3 font-medium">دعوت‌کننده</th>
              <th className="text-right p-3 font-medium">تاریخ دعوت</th>
              <th className="text-right p-3 font-medium">کارت‌ها</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="p-6 text-center text-gray-400">در حال بارگذاری...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={9} className="p-6 text-center text-gray-400">دعوتنامه‌ای یافت نشد</td></tr>
            ) : (
              items.map((u) => (
                <tr key={u.id} className="border-t border-gray-100 dark:border-gray-800">
                  <td className="p-3">
                    <div className="font-medium">{u.name || "—"}</div>
                    <div className="text-xs text-gray-500" dir="ltr">{u.email || u.phone}</div>
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${u.trialActive ? "bg-green-500/10 text-green-600" : "bg-gray-500/10 text-gray-500"}`}>
                      {u.trialActive ? "آزمایشی فعال" : "منقضی/غیرفعال"}
                    </span>
                  </td>
                  <td className="p-3">{u.realEstatePackage ? "دارد" : "—"}</td>
                  <td className="p-3" dir="ltr">{u.referralCode || "—"}</td>
                  <td className="p-3">{u.mustChangePassword ? "بله" : "خیر"}</td>
                  <td className="p-3">{u.invitedByAdminName || "—"}</td>
                  <td className="p-3">{formatDate(u.invitedAt)}</td>
                  <td className="p-3">{u.cardCount}</td>
                  <td className="p-3">
                    <button
                      onClick={() => router.push(`/admin/invites?userId=${u.id}`)}
                      className="flex items-center gap-1 text-orange-500 hover:underline text-xs"
                    >
                      مشاهده
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
