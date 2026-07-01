"use client";

import { useState } from "react";
import { Bot, CheckCircle, XCircle, Settings } from "lucide-react";
import { formatNumber } from "@/lib/utils/jalali";
import toast from "react-hot-toast";

const DEFAULT_MODELS = [
  {
    id: "haiku",
    name: "Claude Haiku 4.5",
    modelId: "claude-haiku-4-5-20251001",
    provider: "Anthropic",
    isActive: true,
    plans: ["FREE", "BASIC", "PRO", "TEAM"],
    inputPrice: 0.8,
    outputPrice: 4,
    maxTokens: 8096,
    requests: 12450,
    errors: 3,
  },
  {
    id: "sonnet",
    name: "Claude Sonnet 4.6",
    modelId: "claude-sonnet-4-6",
    provider: "Anthropic",
    isActive: true,
    plans: ["BASIC", "PRO", "TEAM"],
    inputPrice: 3,
    outputPrice: 15,
    maxTokens: 8096,
    requests: 5230,
    errors: 1,
  },
  {
    id: "opus",
    name: "Claude Opus 4.8",
    modelId: "claude-opus-4-8",
    provider: "Anthropic",
    isActive: true,
    plans: ["PRO", "TEAM"],
    inputPrice: 15,
    outputPrice: 75,
    maxTokens: 8096,
    requests: 890,
    errors: 0,
  },
];

const PLAN_COLORS: Record<string, string> = {
  FREE: "#71717a",
  BASIC: "#3b82f6",
  PRO: "#ea580c",
  TEAM: "#8b5cf6",
};

export default function AdminModelsPage() {
  const [models, setModels] = useState(DEFAULT_MODELS);

  function toggleModel(id: string) {
    setModels((prev) =>
      prev.map((m) => m.id === id ? { ...m, isActive: !m.isActive } : m)
    );
    toast.success("وضعیت مدل بروزرسانی شد");
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>مدیریت مدل‌های AI</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>مدیریت و تنظیمات مدل‌های هوش مصنوعی</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {models.map((model) => (
          <div
            key={model.id}
            className="p-5 rounded-2xl space-y-4"
            style={{
              background: "var(--surface-1)",
              border: `1px solid ${model.isActive ? "rgba(234,88,12,0.3)" : "var(--border)"}`,
            }}
          >
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(234,88,12,0.15)" }}>
                  <Bot className="w-5 h-5" style={{ color: "var(--primary)" }} />
                </div>
                <div>
                  <div className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{model.name}</div>
                  <div className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>{model.modelId}</div>
                </div>
              </div>
              {model.isActive ? (
                <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(34,197,94,0.1)", color: "var(--success)" }}>
                  <CheckCircle className="w-3 h-3" />
                  فعال
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(239,68,68,0.1)", color: "var(--danger)" }}>
                  <XCircle className="w-3 h-3" />
                  غیرفعال
                </span>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <Stat label="قیمت Input" value={`$${model.inputPrice}/1M`} />
              <Stat label="قیمت Output" value={`$${model.outputPrice}/1M`} />
              <Stat label="درخواست امروز" value={formatNumber(model.requests)} />
              <Stat label="خطاهای امروز" value={String(model.errors)} danger={model.errors > 0} />
            </div>

            {/* Plans access */}
            <div>
              <div className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>دسترسی پلن‌ها:</div>
              <div className="flex flex-wrap gap-1">
                {["FREE", "BASIC", "PRO", "TEAM"].map((plan) => (
                  <span
                    key={plan}
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{
                      background: model.plans.includes(plan) ? PLAN_COLORS[plan] + "22" : "var(--surface-3)",
                      color: model.plans.includes(plan) ? PLAN_COLORS[plan] : "var(--text-muted)",
                      opacity: model.plans.includes(plan) ? 1 : 0.4,
                    }}
                  >
                    {plan}
                  </span>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => toggleModel(model.id)}
                className="flex-1 py-2 rounded-xl text-xs font-medium transition-all"
                style={{
                  background: model.isActive ? "rgba(239,68,68,0.1)" : "rgba(34,197,94,0.1)",
                  color: model.isActive ? "var(--danger)" : "var(--success)",
                }}
              >
                {model.isActive ? "غیرفعال‌کردن" : "فعال‌کردن"}
              </button>
              <button
                className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-medium transition-all"
                style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
              >
                <Settings className="w-3.5 h-3.5" />
                تنظیمات
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="px-3 py-2 rounded-xl" style={{ background: "var(--surface-2)" }}>
      <div className="text-xs mb-0.5" style={{ color: "var(--text-muted)" }}>{label}</div>
      <div className="text-sm font-semibold" style={{ color: danger ? "var(--danger)" : "var(--text-primary)" }}>{value}</div>
    </div>
  );
}
