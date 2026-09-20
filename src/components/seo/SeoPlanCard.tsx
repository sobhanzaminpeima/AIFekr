"use client";

import { useState } from "react";
import { Sparkles, Copy, Check } from "lucide-react";
import { useTranslation, tri } from "@/lib/i18n";

export interface PlanView {
  summary: string;
  title: string;
  metaDescription: string;
  h1: string;
  fixes: { priority: "high" | "medium" | "low"; issue: string; action: string }[];
  contentIdeas: string[];
  pageUrl?: string;
}

/** The AI improvement plan: suggested tags (copyable), prioritised actions and content ideas. Read-only. */
export default function SeoPlanCard({ plan }: { plan: PlanView }) {
  const { lang } = useTranslation();
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (key: string, text: string) => {
    try { navigator.clipboard.writeText(text); } catch { /* clipboard can be blocked; the text stays selectable */ }
    setCopied(key);
    setTimeout(() => setCopied((k) => (k === key ? null : k)), 1800);
  };
  const prio = {
    high: { label: tri(lang, "بالا", "High", "Hoch"), bg: "rgba(239,68,68,0.15)", fg: "#ef4444" },
    medium: { label: tri(lang, "متوسط", "Medium", "Mittel"), bg: "rgba(234,179,8,0.15)", fg: "#eab308" },
    low: { label: tri(lang, "کم", "Low", "Niedrig"), bg: "rgba(34,197,94,0.15)", fg: "#22c55e" },
  } as const;

  const fields = [
    { key: "title", label: tri(lang, "عنوان پیشنهادی (Title)", "Suggested title", "Vorgeschlagener Titel"), value: plan.title, max: 60 },
    { key: "meta", label: tri(lang, "توضیحات پیشنهادی (Meta Description)", "Suggested meta description", "Vorgeschlagene Meta-Beschreibung"), value: plan.metaDescription, max: 160 },
    { key: "h1", label: tri(lang, "H1 پیشنهادی", "Suggested H1", "Vorgeschlagene H1"), value: plan.h1, max: 0 },
  ].filter((f) => f.value);

  return (
    <div className="rounded-2xl p-5 space-y-4" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4" style={{ color: "var(--primary)" }} />
        <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{tri(lang, "برنامه بهبود سئو (بر پایه بررسی واقعی صفحه)", "SEO improvement plan (based on the real audit)", "SEO-Verbesserungsplan (auf Basis der echten Prüfung)")}</span>
      </div>
      {plan.pageUrl && <p className="text-[11px] break-all" dir="ltr" style={{ color: "var(--text-muted)" }}>{plan.pageUrl}</p>}
      {plan.summary && <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{plan.summary}</p>}

      {fields.map((f) => (
        <div key={f.key} className="rounded-xl p-3" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{f.label}{f.max ? ` · ${f.value.length}/${f.max}` : ""}</span>
            <button onClick={() => copy(f.key, f.value)} className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
              {copied === f.key ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}{copied === f.key ? tri(lang, "کپی شد", "Copied", "Kopiert") : tri(lang, "کپی", "Copy", "Kopieren")}
            </button>
          </div>
          <p className="text-sm break-words" style={{ color: "var(--text-primary)" }}>{f.value}</p>
        </div>
      ))}

      {plan.fixes.length > 0 && (
        <div>
          <p className="text-xs font-medium mb-2" style={{ color: "var(--text-secondary)" }}>{tri(lang, "اقدامات به ترتیب اولویت", "Actions in priority order", "Maßnahmen nach Priorität")}</p>
          <div className="space-y-2">
            {plan.fixes.map((f, i) => (
              <div key={i} className="rounded-xl p-3 flex items-start gap-2" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5" style={{ background: prio[f.priority].bg, color: prio[f.priority].fg }}>{prio[f.priority].label}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{f.issue}</p>
                  <p className="text-xs mt-0.5 break-words" style={{ color: "var(--text-muted)" }}>{f.action}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {plan.contentIdeas.length > 0 && (
        <div>
          <p className="text-xs font-medium mb-1" style={{ color: "var(--text-secondary)" }}>{tri(lang, "ایده‌های محتوا", "Content ideas", "Content-Ideen")}</p>
          <ul className="list-disc ps-5 text-xs space-y-0.5" style={{ color: "var(--text-muted)" }}>{plan.contentIdeas.map((c, i) => <li key={i}>{c}</li>)}</ul>
        </div>
      )}
    </div>
  );
}
