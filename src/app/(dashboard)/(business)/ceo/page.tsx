"use client";

import { useState, useRef, useEffect } from "react";
import { Crown, Send, TrendingUp, DollarSign, Swords, Users, Package, AlertTriangle, LayoutDashboard } from "lucide-react";
import ReactMarkdown from "react-markdown";
import Link from "next/link";

const CATEGORIES = [
  { key: "growth", label: "رشد", icon: TrendingUp, color: "#10b981" },
  { key: "finance", label: "مالی", icon: DollarSign, color: "#f59e0b" },
  { key: "competition", label: "رقابت", icon: Swords, color: "#ef4444" },
  { key: "team", label: "تیم", icon: Users, color: "#8b5cf6" },
  { key: "product", label: "محصول", icon: Package, color: "#3b82f6" },
  { key: "risk", label: "ریسک", icon: AlertTriangle, color: "#ea580c" },
];

interface Message {
  role: "user" | "assistant";
  content: string;
  category?: string;
}

export default function CEOPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const question = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: question, category: selectedCategory }]);
    setLoading(true);

    let aiContent = "";
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const history = messages.slice(-8).map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch("/api/ceo/question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, category: selectedCategory, conversationId, history }),
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));
        for (const line of lines) {
          const data = line.slice(6);
          if (data === "[DONE]") break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.text) {
              aiContent += parsed.text;
              setMessages((prev) => [...prev.slice(0, -1), { role: "assistant", content: aiContent }]);
            }
            if (parsed.conversationId) setConversationId(parsed.conversationId);
          } catch {}
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen" style={{ background: "var(--surface-0)" }}>
      {/* Left panel — categories */}
      <div className="w-56 flex-shrink-0 p-4 space-y-2 overflow-y-auto" style={{ background: "var(--surface-1)", borderLeft: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2 mb-4">
          <Crown className="w-5 h-5" style={{ color: "var(--primary)" }} />
          <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>دسته‌بندی</span>
        </div>
        <button
          onClick={() => setSelectedCategory("")}
          className="w-full text-right px-3 py-2.5 rounded-xl text-sm transition-all"
          style={{
            background: !selectedCategory ? "rgba(234,88,12,0.15)" : "transparent",
            color: !selectedCategory ? "var(--primary)" : "var(--text-secondary)",
          }}
        >
          همه موضوعات
        </button>
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const active = selectedCategory === cat.key;
          return (
            <button
              key={cat.key}
              onClick={() => setSelectedCategory(cat.key)}
              className="w-full flex items-center gap-2 text-right px-3 py-2.5 rounded-xl text-sm transition-all"
              style={{
                background: active ? `${cat.color}22` : "transparent",
                color: active ? cat.color : "var(--text-secondary)",
              }}
            >
              <Icon className="w-4 h-4" />
              {cat.label}
            </button>
          );
        })}
        <div className="pt-4" style={{ borderTop: "1px solid var(--border)" }}>
          <p className="text-xs px-1 mb-3" style={{ color: "var(--text-muted)" }}>سوالات نمونه:</p>
          {[
            "چطور ۳۰٪ رشد کنم؟",
            "استراتژی ورود به بازار جدید",
            "چطور تیمم را بهتر مدیریت کنم؟",
            "ریسک‌های اصلی کسب‌وکارم چیست؟",
          ].map((q) => (
            <button
              key={q}
              onClick={() => setInput(q)}
              className="w-full text-right text-xs px-3 py-2 rounded-lg mb-1 transition-all hover:opacity-80"
              style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="p-4 flex items-center justify-between gap-3" style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-1)" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(234,88,12,0.15)" }}>
              <Crown className="w-5 h-5" style={{ color: "var(--primary)" }} />
            </div>
            <div>
              <h1 className="font-bold" style={{ color: "var(--text-primary)" }}>مرکز فرماندهی مدیرعامل</h1>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>مشاور استراتژیک هوش مصنوعی — ۲۰+ سال تجربه</p>
            </div>
          </div>
          <Link
            href="/ceo/orchestrator"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium flex-shrink-0"
            style={{ background: "rgba(234,88,12,0.15)", color: "var(--primary)" }}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            هماهنگ‌کنندهٔ کسب‌وکار (وضعیت کل ابزارها)
          </Link>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Crown className="w-16 h-16 mb-4" style={{ color: "rgba(234,88,12,0.3)" }} />
              <h2 className="text-xl font-semibold mb-2" style={{ color: "var(--text-primary)" }}>مشاور مدیرعامل آماده است</h2>
              <p className="text-sm max-w-md" style={{ color: "var(--text-secondary)" }}>
                سوالات استراتژیک خود را بپرسید. مشاور با تجربه ۲۰+ ساله پاسخ اجرایی و قابل اقدام ارائه می‌دهد.
              </p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-lg flex items-center justify-center ml-3 flex-shrink-0 mt-1" style={{ background: "rgba(234,88,12,0.15)" }}>
                  <Crown className="w-4 h-4" style={{ color: "var(--primary)" }} />
                </div>
              )}
              <div
                className="max-w-[75%] rounded-2xl px-4 py-3 text-sm"
                style={{
                  background: msg.role === "user" ? "var(--primary)" : "var(--surface-1)",
                  color: msg.role === "user" ? "white" : "var(--text-primary)",
                  border: msg.role === "assistant" ? "1px solid var(--border)" : "none",
                }}
              >
                {msg.role === "assistant" ? (
                  <div className="prose prose-invert max-w-none text-sm leading-relaxed">
                    <ReactMarkdown>{msg.content || "..."}</ReactMarkdown>
                  </div>
                ) : msg.content}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="p-4" style={{ borderTop: "1px solid var(--border)", background: "var(--surface-1)" }}>
          <form onSubmit={handleSubmit} className="flex items-end gap-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }}
              placeholder="یک سوال استراتژیک بپرسید..."
              rows={2}
              className="flex-1 px-4 py-3 rounded-xl text-sm outline-none resize-none"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="p-3 rounded-xl transition-all disabled:opacity-40"
              style={{ background: "var(--primary)" }}
            >
              {loading
                ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin block" />
                : <Send className="w-5 h-5 text-white" />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
