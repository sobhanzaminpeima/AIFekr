"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export default function GatewayRecheck({ id, onVerified }: { id: string; onVerified?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();
  return <div className="space-y-2"><button disabled={busy} className="rounded-lg bg-orange-600 px-3 py-2 text-xs text-white disabled:opacity-50" onClick={async () => {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/payments/${id}/verify`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "استعلام ناموفق بود");
      setMessage("پرداخت تأیید و پکیج فعال شد."); onVerified?.(); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "اتصال برقرار نشد"); }
    finally { setBusy(false); }
  }}>{busy ? "در حال استعلام…" : "استعلام و تأیید زرین‌پال"}</button>{message && <p role="status" className="max-w-xs text-xs leading-6">{message}</p>}</div>;
}
