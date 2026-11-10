"use client";
import { useCallback, useEffect, useState } from "react";

type Connection = {
  id: string;
  igUsername: string | null;
  igUserId: string;
  businessId: string | null;
  tokenExpiry: string | null;
  expired: boolean;
  updatedAt: string;
  user: { id: string; name: string | null; email: string | null };
};

export default function SocialConnectionsPage() {
  const [rows, setRows] = useState<Connection[] | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setError("");
    const response = await fetch("/api/admin/social/connections");
    if (!response.ok) return setError("بارگذاری اتصال‌ها انجام نشد.");
    setRows((await response.json()).connections);
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function release(row: Connection) {
    const label = row.igUsername ? "@" + row.igUsername : row.igUserId;
    if (!window.confirm(`اتصال ${label} آزاد شود؟ کمپین‌ها، صف انتشار و سوابق همین اتصال هم حذف می‌شوند و این کار برگشت‌پذیر نیست.`)) return;
    const response = await fetch("/api/admin/social/connections?id=" + encodeURIComponent(row.id), { method: "DELETE" });
    if (!response.ok) return setError("آزادسازی انجام نشد.");
    await load();
  }
  return (
    <main dir="rtl" style={{ padding: 24 }}>
      <h1>اتصال‌های اینستاگرام</h1>
      <p>هر حساب اینستاگرام به کدام حساب AIFekr وصل است. آزادسازی در گزارش فعالیت مدیران ثبت می‌شود.</p>
      {error && <p role="alert">{error}</p>}
      {rows && !rows.length && <p>هنوز حساب اینستاگرامی وصل نشده است.</p>}
      {rows && rows.length > 0 && (
        <table style={{ width: "100%" }}>
          <thead><tr><th>اینستاگرام</th><th>مالک</th><th>فضای کاری</th><th>وضعیت توکن</th><th>آخرین تغییر</th><th>عملیات</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td><bdi>{row.igUsername ? "@" + row.igUsername : row.igUserId}</bdi></td>
                <td><bdi>{row.user.name || row.user.email || row.user.id}</bdi></td>
                <td><bdi>{row.businessId || "—"}</bdi></td>
                <td>{row.expired ? "منقضی" : row.tokenExpiry ? new Date(row.tokenExpiry).toLocaleDateString("fa-IR") : "نامشخص"}</td>
                <td>{new Date(row.updatedAt).toLocaleString("fa-IR")}</td>
                <td><button type="button" onClick={() => release(row)}>آزادسازی</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
