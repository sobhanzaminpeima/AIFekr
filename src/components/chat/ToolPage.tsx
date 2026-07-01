"use client";

import { useState } from "react";
import { Send, Bot, Copy, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import toast from "react-hot-toast";

interface Field {
  key: string;
  label: string;
  placeholder?: string;
}

interface ToolPageProps {
  title: string;
  description: string;
  systemPrompt: string;
  fields: Field[];
  promptTemplate: (values: Record<string, string>) => string;
}

export default function ToolPage({ title, description, systemPrompt, fields, promptTemplate }: ToolPageProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    const missingField = fields.find((f) => !values[f.key]?.trim());
    if (missingField) { toast.error(`لطفاً ${missingField.label} را وارد کنید`); return; }

    setLoading(true);
    setResult("");

    try {
      const message = promptTemplate(values);
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, systemPrompt, history: [] }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("خطا");

      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (line.startsWith("data: ") && line !== "data: [DONE]") {
            try {
              const parsed = JSON.parse(line.slice(6));
              if (parsed.text) { accumulated += parsed.text; setResult(accumulated); }
            } catch { /* skip */ }
          }
        }
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "خطا در پردازش");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{title}</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>{description}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <div className="p-5 rounded-2xl space-y-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <h2 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>اطلاعات شما</h2>
          {fields.map((field) => (
            <div key={field.key}>
              <label className="block text-xs mb-1.5 font-medium" style={{ color: "var(--text-secondary)" }}>{field.label}</label>
              <input
                value={values[field.key] || ""}
                onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                placeholder={field.placeholder}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
              />
            </div>
          ))}
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white transition-all disabled:opacity-50"
            style={{ background: "var(--primary)" }}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            {loading ? "در حال پردازش..." : "دریافت نتیجه"}
          </button>
        </div>

        {/* Result */}
        <div className="p-5 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4" style={{ color: "var(--primary)" }} />
              <h2 className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>نتیجه</h2>
            </div>
            {result && (
              <button onClick={() => { navigator.clipboard.writeText(result); toast.success("کپی شد"); }}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
                style={{ color: "var(--text-muted)", background: "var(--surface-2)" }}>
                <Copy className="w-3 h-3" />
                کپی
              </button>
            )}
          </div>
          {result ? (
            <div className="prose prose-sm max-w-none text-sm" style={{ color: "var(--text-primary)" }}>
              <ReactMarkdown>{result}</ReactMarkdown>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48" style={{ color: "var(--text-muted)" }}>
              <Bot className="w-10 h-10 mb-2 opacity-20" />
              <p className="text-sm">نتیجه اینجا نمایش داده می‌شود</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
