"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowRight, ArrowLeft, Sparkles, Send, AlertTriangle } from "lucide-react";
import { tri, type Lang } from "@/lib/i18n";
import { useAccountingLocale } from "@/lib/accounting/useAccountingLocale";
import { linkifyCitations } from "@/lib/accounting/linkifyCitations";
import AccountingNav from "@/components/accounting/AccountingNav";

interface ChatMessage { role: "user" | "assistant"; text: string; }
interface AnomalyAlert { accountCode: string; accountName: string; currentMonthAmount: number; trailingAverage: number; deviationPercent: number; }

function suggestions(lang: Lang) { return [
  tri(lang, "موجودی نقدی فعلی چقدر است؟", "What is the current cash balance?", "Wie hoch ist der aktuelle Kassenbestand?"),
  tri(lang, "بزرگ‌ترین هزینه این ماه چه بوده؟", "What was the biggest expense this month?", "Was war die größte Ausgabe in diesem Monat?"),
  tri(lang, "آیا کسری نقدینگی در راه است؟", "Is a cash shortfall coming?", "Droht ein Liquiditätsengpass?"),
  tri(lang, "سود خالص این ماه نسبت به ماه قبل چطور بوده؟", "How does this month's net profit compare to last month?", "Wie ist der Nettogewinn dieses Monats im Vergleich zum Vormonat?"),
]; }

export default function FinanceAssistantPage() {
  const { lang, dir, fmtNum: fmt, fmtDate, fmtMonth: monthLabel } = useAccountingLocale();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [anomalies, setAnomalies] = useState<AnomalyAlert[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/accounting/ai/anomalies", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setAnomalies(d.alerts || []))
      .catch(() => {});
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function ask(question: string) {
    if (!question.trim() || loading) return;
    setMessages((prev) => [...prev, { role: "user", text: question }, { role: "assistant", text: "" }]);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/accounting/ai/ask", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      if (!res.ok || !res.body) throw new Error(tri(lang, "خطا در پاسخ‌دهی", "Failed to answer", "Antwort fehlgeschlagen"));
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);
          if (payload === "[DONE]") continue;
          const parsed = JSON.parse(payload) as { text?: string; error?: string };
          if (parsed.error) throw new Error(parsed.error);
          if (parsed.text) {
            setMessages((prev) => {
              const next = [...prev];
              next[next.length - 1] = { role: "assistant", text: next[next.length - 1].text + parsed.text };
              return next;
            });
          }
        }
      }
    } catch (e) {
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: "assistant", text: e instanceof Error ? e.message : tri(lang, "خطا در پاسخ‌دهی", "Failed to answer", "Antwort fehlgeschlagen") };
        return next;
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4 flex flex-col" dir={dir} style={{ minHeight: "80vh" }}>
      <AccountingNav />
      <div className="flex items-center gap-2">
        <Link href="/accounting" className="p-1.5 rounded-lg" style={{ color: "var(--text-secondary)" }}>{dir === "rtl" ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}</Link>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}><Sparkles className="w-5 h-5" style={{ color: "var(--primary)" }} />{tri(lang, "دستیار هوشمند مالی", "AI finance assistant", "KI-Finanzassistent")}</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>{tri(lang, "فقط بر اساس داده‌های واقعی دفتر کل پاسخ می‌دهد — هرگز عددی نمی‌سازد", "Answers only from real ledger data — it never invents a number", "Antwortet ausschließlich aus echten Hauptbuchdaten — erfindet nie eine Zahl")}</p>
        </div>
      </div>

      {anomalies.length > 0 && (
        <div className="rounded-2xl p-4" style={{ background: "rgba(237,161,0,0.08)", border: "1px solid rgba(237,161,0,0.3)" }}>
          <div className="flex items-center gap-1.5 text-sm font-medium mb-2" style={{ color: "#eda100" }}><AlertTriangle className="w-4 h-4" />{tri(lang, "ناهنجاری‌های شناسایی‌شده", "Detected anomalies", "Erkannte Anomalien")}</div>
          {anomalies.map((a) => (
            <div key={a.accountCode} className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {a.accountName}: {fmt(a.currentMonthAmount)} {tri(lang, "این ماه در مقابل میانگین", "this month vs. average", "diesen Monat vs. Durchschnitt")} {fmt(a.trailingAverage)} ({a.deviationPercent > 0 ? "+" : ""}{a.deviationPercent}٪)
            </div>
          ))}
        </div>
      )}

      <div className="flex-1 rounded-2xl p-4 space-y-3 overflow-auto" style={{ background: "var(--surface-1)", border: "1px solid var(--border)", minHeight: "300px" }}>
        {messages.length === 0 ? (
          <div className="space-y-2">
            <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>{tri(lang, "چند نمونه سؤال:", "A few example questions:", "Einige Beispielfragen:")}</p>
            {suggestions(lang).map((s) => (
              <button key={s} onClick={() => ask(s)} className="block w-full text-right text-sm px-3 py-2 rounded-lg" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>{s}</button>
            ))}
          </div>
        ) : messages.map((m, i) => (
          <div key={i} className={`rounded-xl p-3 text-sm leading-6 ${m.role === "user" ? "mr-8" : "ml-8"}`} style={{ background: m.role === "user" ? "var(--primary)" : "var(--surface-2)", color: m.role === "user" ? "#fff" : "var(--text-primary)" }}>
            {m.text ? (m.role === "assistant" ? linkifyCitations(m.text) : m.text) : (loading && i === messages.length - 1 ? "..." : "")}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask(input)}
          placeholder={tri(lang, tri(lang, "سؤال خود را دربارهٔ وضعیت مالی بپرسید...", "Ask a question about your finances…", "Stellen Sie eine Frage zu Ihren Finanzen…"), "Ask a question about your finances…", "Stellen Sie eine Frage zu Ihren Finanzen…")}
          disabled={loading}
          className="flex-1 px-3 py-2 rounded-lg text-sm"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
        />
        <button disabled={loading} onClick={() => ask(input)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "var(--primary)", color: "#fff" }}>
          <Send className="w-4 h-4" />{tri(lang, "ارسال", "Send", "Senden")}
        </button>
      </div>
    </div>
  );
}
