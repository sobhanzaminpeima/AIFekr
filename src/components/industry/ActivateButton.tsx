"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ActivateButton({ slug, color, label }: { slug: string; color: string; label: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function activate() {
    setLoading(true);
    try {
      const res = await fetch(`/api/packs/${slug}`, { method: "POST" });
      if (res.ok) {
        router.push("/business-doctor?activated=1");
      } else {
        const d = await res.json();
        alert(d.error || "خطا در فعال‌سازی");
      }
    } catch {
      alert("خطا در ارتباط با سرور");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button onClick={activate} disabled={loading}
      className="w-full py-3 rounded-xl font-semibold text-white transition-all disabled:opacity-60"
      style={{ background: color }}>
      {loading ? "در حال فعال‌سازی..." : label}
    </button>
  );
}