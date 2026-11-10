"use client";
import { useCallback, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useTranslation } from "@/lib/i18n";
import { tri } from "@/lib/i18n/tri";

type Row = { id: string; tool: string; keyword: string | null; url: string | null; credits: number; status: string; createdAt: string };

/** Saved results of the paid SEO tools, reopened from any later visit. */
export function SeoGenerationHistory({ refresh }: { refresh: number }) {
  const { lang } = useTranslation();
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState<{ id: string; output: string } | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/seo/generations", { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    setRows((await res.json()).generations);
  }, []);

  useEffect(() => { setFailed(false); load().catch(() => setFailed(true)); }, [load, refresh]);

  const show = async (id: string) => {
    setFailed(false);
    try {
      const res = await fetch(`/api/seo/generations?id=${encodeURIComponent(id)}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      setOpen((await res.json()).generation);
    } catch { setFailed(true); }
  };

  if (!rows.length && !failed) return null;
  return (
    <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
      <h2 className="text-sm font-medium mb-3" style={{ color: "var(--text-secondary)" }}>{tri(lang, "نتایج ذخیره‌شده", "Saved results", "Gespeicherte Ergebnisse", "Kayıtlı sonuçlar")}</h2>
      {failed && <p role="alert" className="text-xs mb-2" style={{ color: "var(--danger, #ef4444)" }}>{tri(lang, "بارگذاری انجام نشد؛ دوباره تلاش کنید.", "Couldn't load; please try again.", "Laden fehlgeschlagen; bitte erneut versuchen.", "Yüklenemedi; lütfen tekrar deneyin.")}</p>}
      <ul className="flex flex-col gap-1">
        {rows.map((row) => (
          <li key={row.id}>
            <button onClick={() => show(row.id)} className="w-full flex justify-between gap-3 text-xs px-3 py-2 rounded-lg" style={{ background: "var(--surface-2)", color: "var(--text-primary)" }}>
              <span className="truncate">{row.keyword || row.url || row.tool}</span>
              <span style={{ color: "var(--text-muted)" }}>{new Date(row.createdAt).toLocaleDateString(lang === "fa" ? "fa-IR" : lang)}</span>
            </button>
            {open?.id === row.id && <div className="prose prose-invert prose-sm max-w-none p-3" style={{ color: "var(--text-primary)" }}><ReactMarkdown>{open.output}</ReactMarkdown></div>}
          </li>
        ))}
      </ul>
    </div>
  );
}
