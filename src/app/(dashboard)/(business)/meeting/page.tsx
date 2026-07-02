"use client";

import { useState } from "react";
import { Users, Play, Copy, Check, Crown, Megaphone, DollarSign, Search, Handshake, Package, Scale } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { LucideIcon } from "lucide-react";

interface Agent { key: string; name: string; Icon: LucideIcon; color: string; }

const AVAILABLE_AGENTS: Agent[] = [
  { key: "ceo", name: "CEO Agent", Icon: Crown, color: "#ea580c" },
  { key: "marketing", name: "Marketing Agent", Icon: Megaphone, color: "#8b5cf6" },
  { key: "finance", name: "Finance Agent", Icon: DollarSign, color: "#10b981" },
  { key: "seo", name: "SEO Agent", Icon: Search, color: "#3b82f6" },
  { key: "sales", name: "Sales Agent", Icon: Handshake, color: "#f59e0b" },
  { key: "product", name: "Product Manager", Icon: Package, color: "#ec4899" },
  { key: "legal", name: "Legal Advisor", Icon: Scale, color: "#6b7280" },
];

export default function MeetingPage() {
  const [topic, setTopic] = useState("");
  const [selectedAgents, setSelectedAgents] = useState<string[]>(["ceo", "marketing", "finance"]);
  const [transcript, setTranscript] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [started, setStarted] = useState(false);

  function toggleAgent(key: string) {
    setSelectedAgents((prev) =>
      prev.includes(key)
        ? prev.filter((k) => k !== key)
        : prev.length < 5 ? [...prev, key] : prev
    );
  }

  async function startMeeting() {
    if (!topic || selectedAgents.length < 2) return;
    setLoading(true);
    setTranscript("");
    setStarted(true);

    try {
      const res = await fetch("/api/meeting/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, agents: selectedAgents }),
      });
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split("\n").filter((l) => l.startsWith("data: "))) {
          const data = line.slice(6);
          if (data === "[DONE]") break;
          try {
            const p = JSON.parse(data);
            if (p.text) setTranscript((prev) => prev + p.text);
          } catch {}
        }
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen p-6" style={{ background: "var(--surface-0)" }}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "rgba(99,102,241,0.15)" }}>
            <Users className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>اتاق جلسه عوامل هوش مصنوعی</h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>شبیه‌سازی جلسه استراتژیک با چند عامل هوش مصنوعی</p>
          </div>
        </div>

        {/* Setup */}
        {!started && (
          <div className="rounded-2xl p-6 mb-6" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <div className="mb-5">
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>موضوع / دستور کار جلسه</label>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="مثال: آیا باید در سه‌ماهه سوم وارد بازار جدید شویم؟ چه استراتژی رشدی باید دنبال کنیم؟"
                rows={3}
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none resize-none"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              />
            </div>
            <div className="mb-5">
              <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
                انتخاب عوامل هوش مصنوعی (۲ تا ۵ عامل)
                <span className="mr-2 text-xs" style={{ color: "var(--text-muted)" }}>({selectedAgents.length} انتخاب شده)</span>
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {AVAILABLE_AGENTS.map((agent) => {
                  const selected = selectedAgents.includes(agent.key);
                  return (
                    <button
                      key={agent.key}
                      onClick={() => toggleAgent(agent.key)}
                      className="flex items-center gap-2 p-3 rounded-xl text-sm font-medium transition-all text-right"
                      style={{
                        background: selected ? `${agent.color}22` : "var(--surface-2)",
                        border: selected ? `1px solid ${agent.color}55` : "1px solid var(--border)",
                        color: selected ? agent.color : "var(--text-secondary)",
                      }}
                    >
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${agent.color}20` }}>
                        <agent.Icon className="w-3.5 h-3.5" style={{ color: agent.color }} />
                      </div>
                      <span className="text-xs leading-tight">{agent.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <button
              onClick={startMeeting}
              disabled={!topic || selectedAgents.length < 2 || loading}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium text-white disabled:opacity-50"
              style={{ background: "var(--primary)" }}
            >
              <Play className="w-4 h-4" />
              شروع جلسه
            </button>
          </div>
        )}

        {/* Transcript */}
        {started && (
          <div className="rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between p-4" style={{ borderBottom: "1px solid var(--border)" }}>
              <div>
                <h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>جلسه: {topic.slice(0, 60)}{topic.length > 60 ? "..." : ""}</h2>
                <div className="flex gap-2 mt-1">
                  {selectedAgents.map((key) => {
                    const agent = AVAILABLE_AGENTS.find((a) => a.key === key);
                    return agent ? (
                      <span key={key} className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: `${agent.color}22`, color: agent.color }}>
                        <agent.Icon className="w-3 h-3" />
                        {agent.name}
                      </span>
                    ) : null;
                  })}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { navigator.clipboard.writeText(transcript); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
                  style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "کپی شد" : "کپی متن"}
                </button>
                <button
                  onClick={() => { setStarted(false); setTranscript(""); }}
                  className="px-3 py-1.5 rounded-lg text-xs"
                  style={{ background: "rgba(234,88,12,0.15)", color: "var(--primary)" }}
                >
                  جلسه جدید
                </button>
              </div>
            </div>
            <div className="p-6">
              {loading && !transcript && (
                <div className="flex items-center gap-3 py-8 justify-center">
                  <span className="w-5 h-5 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
                  <span className="text-sm" style={{ color: "var(--text-secondary)" }}>جلسه در حال برگزاری است...</span>
                </div>
              )}
              <div className="prose prose-invert max-w-none text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
                <ReactMarkdown>{transcript}</ReactMarkdown>
              </div>
              {loading && transcript && (
                <div className="flex items-center gap-2 mt-4">
                  <span className="w-4 h-4 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>جلسه در حال ادامه...</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
