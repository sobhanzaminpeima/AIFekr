"use client";

import { useState } from "react";
import { GraduationCap, Stethoscope, Languages, ChefHat, Dumbbell, Plane, Code2, Briefcase, TrendingUp, ShoppingCart, Calculator, Salad } from "lucide-react";
import toast from "react-hot-toast";

const TOOLS = [
  { id: "business-ideas", name: "ایده کسب‌وکار", type: "tool", icon: Briefcase, active: true, uses: 2340 },
  { id: "trading", name: "تحلیل بازار", type: "tool", icon: TrendingUp, active: true, uses: 1890 },
  { id: "drop-shipping", name: "دراپشیپینگ", type: "tool", icon: ShoppingCart, active: true, uses: 1240 },
  { id: "math", name: "حل ریاضیات", type: "tool", icon: Calculator, active: true, uses: 3450 },
  { id: "healthy-diet", name: "برنامه غذایی", type: "tool", icon: Salad, active: true, uses: 2100 },
  { id: "teacher", name: "معلم هوشمند", type: "assistant", icon: GraduationCap, active: true, uses: 5670 },
  { id: "doctor", name: "مشاور پزشکی", type: "assistant", icon: Stethoscope, active: true, uses: 3210 },
  { id: "translator", name: "مترجم حرفه‌ای", type: "assistant", icon: Languages, active: true, uses: 4560 },
  { id: "cooking", name: "آشپز هوشمند", type: "assistant", icon: ChefHat, active: true, uses: 2890 },
  { id: "fitness-coach", name: "مربی بدنسازی", type: "assistant", icon: Dumbbell, active: false, uses: 1230 },
  { id: "travel-agent", name: "مشاور سفر", type: "assistant", icon: Plane, active: true, uses: 980 },
  { id: "code-expert", name: "کارشناس کد", type: "assistant", icon: Code2, active: true, uses: 6780 },
];

export default function AdminToolsPage() {
  const [tools, setTools] = useState(TOOLS);

  function toggleTool(id: string) {
    setTools((prev) => prev.map((t) => t.id === id ? { ...t, active: !t.active } : t));
    toast.success("وضعیت بروزرسانی شد");
  }

  const toolsList = tools.filter((t) => t.type === "tool");
  const assistantsList = tools.filter((t) => t.type === "assistant");

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>مدیریت ابزارها و دستیارها</h1>

      <section>
        <h2 className="font-semibold mb-3" style={{ color: "var(--text-secondary)" }}>ابزارها</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {toolsList.map((tool) => <ToolCard key={tool.id} tool={tool} onToggle={() => toggleTool(tool.id)} />)}
        </div>
      </section>

      <section>
        <h2 className="font-semibold mb-3" style={{ color: "var(--text-secondary)" }}>دستیارها</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {assistantsList.map((tool) => <ToolCard key={tool.id} tool={tool} onToggle={() => toggleTool(tool.id)} />)}
        </div>
      </section>
    </div>
  );
}

function ToolCard({ tool, onToggle }: { tool: typeof TOOLS[0]; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between p-4 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)", opacity: tool.active ? 1 : 0.6 }}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(234,88,12,0.15)" }}>
          <tool.icon className="w-5 h-5" style={{ color: "var(--primary)" }} />
        </div>
        <div>
          <div className="font-medium text-sm" style={{ color: "var(--text-primary)" }}>{tool.name}</div>
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>{tool.uses.toLocaleString("fa-IR")} بار استفاده</div>
        </div>
      </div>
      <button
        onClick={onToggle}
        className="relative w-11 h-6 rounded-full transition-all"
        style={{ background: tool.active ? "var(--primary)" : "var(--surface-3)" }}
      >
        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${tool.active ? "right-1" : "left-1"}`} />
      </button>
    </div>
  );
}
