"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { Magnet, Loader2, Trash2, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import toast from "react-hot-toast";

interface Row {
  id: string;
  userId: string;
  userLabel: string;
  userName: string | null;
  externalId: string;
  name: string;
  status: string;
  lastError: string | null;
  leadsImported: number;
  lastLeadAt: string | null;
  hasToken: boolean;
  createdAt: string;
}

export default function AdminLeadConnectorsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Record<string, { pageId: string; pageToken: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);

  function load() {
    setLoading(true);
    fetch("/api/admin/lead-connectors", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setRows(d.rows || []))
      .catch(() => toast.error("خطا در بارگذاری"))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function fulfill(id: string) {
    const f = form[id];
    if (!f?.pageId?.trim() || !f?.pageToken?.trim()) {
      toast.error("Page ID و Page Token را وارد کنید");
      return;
    }
    setSaving(id);
    try {
      const res = await fetch("/api/admin/lead-connectors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id, pageId: f.pageId.trim(), pageToken: f.pageToken.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "خطا");
      toast.success(data.warn || "اتصال فعال شد");
      setForm((p) => ({ ...p, [id]: { pageId: "", pageToken: "" } }));
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا");
    } finally {
      setSaving(null);
    }
  }

  async function remove(id: string) {
    if (!confirm("این ردیف حذف شود؟")) return;
    await fetch(`/api/admin/lead-connectors?id=${id}`, { method: "DELETE", credentials: "include" });
    load();
  }

  const pending = rows.filter((r) => r.status === "pending");
  const others = rows.filter((r) => r.status !== "pending");

  return (
    <div className="p-6 max-w-4xl" dir="rtl">
      <div className="flex items-center gap-2 mb-1">
        <Magnet className="w-6 h-6" style={{ color: "#ea580c" }} />
        <h1 className="text-xl font-bold">اتصال‌های Meta Lead Ads</h1>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        تا وقتی App Review تأیید نشده، اتصال Meta هر شرکت را دستی اینجا فعال کنید: Page ID و یک Page Access Token از پیج همان شرکت بگیرید (از خودشان یا از Graph API Explorer بعد از افزوده‌شدن به پیج) و وارد کنید.
      </p>

      {loading ? (
        <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : (
        <>
          <h2 className="font-semibold text-sm mb-2 flex items-center gap-1.5"><Clock className="w-4 h-4 text-amber-500" /> در انتظار ({pending.length})</h2>
          {pending.length === 0 ? (
            <p className="text-sm text-gray-400 mb-6">درخواستی در انتظار نیست.</p>
          ) : (
            <div className="space-y-3 mb-8">
              {pending.map((r) => (
                <div key={r.id} className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="font-medium">{r.userName || r.userLabel}</span>
                      <span className="text-xs text-gray-500 ms-2">{r.userLabel}</span>
                      <p className="text-xs text-gray-500 mt-0.5">پیج درخواستی: {r.name}{r.lastError ? ` — یادداشت: ${r.lastError}` : ""}</p>
                    </div>
                    <button onClick={() => remove(r.id)} className="p-1.5 rounded-lg bg-white/60"><Trash2 className="w-4 h-4 text-gray-500" /></button>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2 mb-2">
                    <input placeholder="Page ID" value={form[r.id]?.pageId || ""}
                      onChange={(e) => setForm((p) => ({ ...p, [r.id]: { ...(p[r.id] || { pageId: "", pageToken: "" }), pageId: e.target.value } }))}
                      className="rounded-lg border px-3 py-2 text-sm bg-white dark:bg-gray-900" />
                    <input placeholder="Page Access Token" value={form[r.id]?.pageToken || ""}
                      onChange={(e) => setForm((p) => ({ ...p, [r.id]: { ...(p[r.id] || { pageId: "", pageToken: "" }), pageToken: e.target.value } }))}
                      className="rounded-lg border px-3 py-2 text-sm bg-white dark:bg-gray-900" />
                  </div>
                  <button onClick={() => fulfill(r.id)} disabled={saving === r.id}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: "linear-gradient(135deg,#ea580c,#f97316)" }}>
                    {saving === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    فعال‌سازی اتصال
                  </button>
                </div>
              ))}
            </div>
          )}

          <h2 className="font-semibold text-sm mb-2">همه‌ی اتصال‌ها ({others.length})</h2>
          {others.length === 0 ? (
            <p className="text-sm text-gray-400">اتصالی نیست.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 text-xs text-right">
                    <th className="py-2 pe-3">کاربر</th>
                    <th className="py-2 pe-3">پیج</th>
                    <th className="py-2 pe-3">وضعیت</th>
                    <th className="py-2 pe-3">لید</th>
                    <th className="py-2 pe-3">آخرین لید</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {others.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="py-2 pe-3">{r.userName || r.userLabel}</td>
                      <td className="py-2 pe-3">{r.name}<span className="text-gray-400 text-xs ms-1">{r.externalId}</span></td>
                      <td className="py-2 pe-3">
                        <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded ${r.status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                          {r.status === "active" ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                          {r.status}
                        </span>
                        {r.lastError ? <p className="text-[11px] text-red-500 mt-0.5">{r.lastError}</p> : null}
                      </td>
                      <td className="py-2 pe-3">{r.leadsImported}</td>
                      <td className="py-2 pe-3 whitespace-nowrap">{r.lastLeadAt ? new Date(r.lastLeadAt).toLocaleDateString("fa-IR") : "—"}</td>
                      <td className="py-2"><button onClick={() => remove(r.id)}><Trash2 className="w-4 h-4 text-gray-400" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
