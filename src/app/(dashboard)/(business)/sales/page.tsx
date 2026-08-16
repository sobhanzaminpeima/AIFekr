"use client";

import { useState, useEffect, useCallback } from "react";
import { Handshake, Sparkles, Loader2, Send, Mail, Check } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useTranslation } from "@/lib/i18n";

const STR = {
  fa: {
    title: "ایجنت فروش",
    subtitle: "مدیر فروش هوش مصنوعی — پیش‌بینی، معاملات در خطر، اعتراض‌ها، Battlecard و کوچینگ",
    runAnalysis: "تحلیل Pipeline فروش",
    memoryHeader: "نکاتی برای حافظهٔ آینده",
    followUpsTitle: "پیام‌های پیگیری آماده",
    followUpsDesc: "پیش‌نویس پیام‌های کوتاه و آمادهٔ ارسال برای لیدهای نیازمند پیگیری",
    generateDrafts: "تولید پیام‌های پیگیری",
    noDrafts: "لیدی برای پیگیری یافت نشد",
    send: "ارسال ایمیل",
    sent: "ارسال شد",
    noEmail: "بدون ایمیل",
    needsCrm: "این قابلیت نیاز به خرید افزونه CRM دارد",
    ownerOnly: "فقط مدیر یا مالک می‌تواند تحلیل ایجنت فروش را اجرا کند",
  },
  en: {
    title: "Sales Agent",
    subtitle: "AI Sales Manager — forecasting, at-risk deals, objection handling, battlecard and coaching",
    runAnalysis: "Analyze Sales Pipeline",
    memoryHeader: "Notes for future memory",
    followUpsTitle: "Ready-to-Send Follow-Ups",
    followUpsDesc: "Short, ready-to-send message drafts for leads that need follow-up",
    generateDrafts: "Generate Follow-Up Drafts",
    noDrafts: "No leads need follow-up right now",
    send: "Send Email",
    sent: "Sent",
    noEmail: "No email",
    needsCrm: "This feature requires the CRM add-on",
    ownerOnly: "Only a manager or owner can run the Sales Agent analysis",
  },
} as const;

interface FollowUpDraft {
  contactId: string;
  name: string;
  email: string | null;
  phone: string | null;
  message: string;
}

export default function SalesAgentPage() {
  const { lang } = useTranslation();
  const isFa = lang === "fa";
  const s = STR[isFa ? "fa" : "en"];

  const [running, setRunning] = useState(false);
  const [analysis, setAnalysis] = useState("");
  const [error, setError] = useState("");

  const [drafts, setDrafts] = useState<FollowUpDraft[]>([]);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [sendingId, setSendingId] = useState<string | null>(null);

  async function runAgent() {
    setRunning(true);
    setAnalysis("");
    setError("");
    try {
      const res = await fetch("/api/sales/agent", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || (isFa ? "خطا در تحلیل" : "Analysis failed"));
        return;
      }
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") continue;
          try {
            const evt = JSON.parse(data);
            if (evt.text) setAnalysis((p) => p + evt.text);
            if (evt.error) setError(evt.error);
          } catch {}
        }
      }
    } finally {
      setRunning(false);
    }
  }

  const loadDrafts = useCallback(async () => {
    setLoadingDrafts(true);
    try {
      const res = await fetch("/api/sales/followups");
      const data = await res.json();
      setDrafts(data.drafts || []);
    } finally {
      setLoadingDrafts(false);
    }
  }, []);

  async function sendDraft(d: FollowUpDraft) {
    setSendingId(d.contactId);
    try {
      const res = await fetch("/api/sales/followups/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId: d.contactId, message: d.message }),
      });
      if (res.ok) setSentIds((prev) => new Set(prev).add(d.contactId));
    } finally {
      setSendingId(null);
    }
  }

  const memoryHeaderPattern = isFa ? /## ۶?\.?\s*نکاتی برای حافظهٔ آینده/ : /## Notes for future memory/;

  return (
    <div className="min-h-screen p-6" style={{ background: "var(--surface-0)" }}>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "rgba(245,158,11,0.15)" }}>
            <Handshake className="w-6 h-6" style={{ color: "#f59e0b" }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{s.title}</h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{s.subtitle}</p>
          </div>
        </div>

        {/* Pipeline analysis */}
        <div className="rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{s.subtitle}</p>
          <button onClick={runAgent} disabled={running}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--primary)" }}>
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {s.runAnalysis}
          </button>
        </div>

        {error && (
          <div className="rounded-xl p-3 text-sm" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>{error}</div>
        )}

        {analysis && (
          <div className="rounded-2xl p-5 prose prose-invert prose-sm max-w-none leading-7" style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
            <ReactMarkdown>{analysis.split(memoryHeaderPattern)[0].trim()}</ReactMarkdown>
          </div>
        )}

        {/* Follow-up drafts */}
        <div className="rounded-2xl p-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
            <div>
              <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{s.followUpsTitle}</h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{s.followUpsDesc}</p>
            </div>
            <button onClick={loadDrafts} disabled={loadingDrafts}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold disabled:opacity-50"
              style={{ background: "var(--surface-2)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
              {loadingDrafts ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
              {s.generateDrafts}
            </button>
          </div>

          {drafts.length === 0 && !loadingDrafts ? (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{s.noDrafts}</p>
          ) : (
            <div className="space-y-2">
              {drafts.map((d) => {
                const sent = sentIds.has(d.contactId);
                return (
                  <div key={d.contactId} className="rounded-xl p-3 flex items-start justify-between gap-3" style={{ background: "var(--surface-2)" }}>
                    <div className="flex-1">
                      <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{d.name}</p>
                      <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>{d.message}</p>
                    </div>
                    {sent ? (
                      <span className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg flex-shrink-0" style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e" }}>
                        <Check className="w-3.5 h-3.5" />{s.sent}
                      </span>
                    ) : d.email ? (
                      <button onClick={() => sendDraft(d)} disabled={sendingId === d.contactId}
                        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg flex-shrink-0 disabled:opacity-50"
                        style={{ background: "var(--primary)", color: "white" }}>
                        {sendingId === d.contactId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        {s.send}
                      </button>
                    ) : (
                      <span className="text-xs px-2.5 py-1.5 rounded-lg flex-shrink-0" style={{ background: "var(--surface-1)", color: "var(--text-muted)" }}>{s.noEmail}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
