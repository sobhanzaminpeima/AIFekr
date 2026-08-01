"use client";

import { useState } from "react";
import { Share2, Check, Copy } from "lucide-react";

interface Props {
  type: "business-analysis" | "content-pipeline";
  id: string;
}

export default function ShareButton({ type, id }: Props) {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    setLoading(true);
    try {
      const res = await fetch("/api/share/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, id }),
      });
      const data = await res.json();
      if (!data.token) throw new Error();

      const url = `${window.location.origin}/share/${data.token}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      alert("خطا در ساخت لینک");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleShare}
      disabled={loading}
      title="اشتراک‌گذاری"
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "7px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
        border: "1px solid rgba(255,255,255,0.12)",
        background: copied ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.06)",
        color: copied ? "#4ade80" : "rgba(255,255,255,0.7)",
        transition: "all 0.2s",
      }}
    >
      {copied ? <Check size={14} /> : loading ? <Share2 size={14} style={{ opacity: 0.5 }} /> : <Share2 size={14} />}
      {copied ? "لینک کپی شد!" : "اشتراک‌گذاری"}
    </button>
  );
}
