"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, ArrowLeft, ArrowRight, Lock } from "lucide-react";
import { useTranslation, tri } from "@/lib/i18n";
import { REAL_ESTATE_MODULES, type ModuleDefinition } from "@/lib/industry/moduleRegistry";

/**
 * "My Agents" hub — answers "which agents come with my industry pack, and
 * where do I actually go to use them?" The individual agents live scattered
 * across CRM tabs (Properties, Viewings, Performance, ...) and the Voice
 * Agent page, discoverable only by exploring each one manually. This page
 * is a single, data-driven list (from moduleRegistry.ts) filtered to what's
 * actually enabled for the current user, each card linking straight to
 * where that agent lives.
 *
 * Only real-estate has agent modules registered today — the list is empty
 * (and the empty-state explains why) for every other pack until more are
 * built, rather than hardcoding a real-estate-only page.
 */

const ALL_AGENT_MODULES: ModuleDefinition[] = [...REAL_ESTATE_MODULES].filter((m) => m.category === "agent");

export default function MyAgentsPage() {
  const { lang } = useTranslation();
  const isFa = lang === "fa";
  const [loading, setLoading] = useState(true);
  const [access, setAccess] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const keys = ALL_AGENT_MODULES.map((m) => m.key).join(",");
    fetch(`/api/crm/module-access?keys=${keys}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setAccess(d.access || {}))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const enabledAgents = ALL_AGENT_MODULES.filter((m) => access[m.key]);
  const BackIcon = isFa ? ArrowRight : ArrowLeft;

  return (
    <div dir={isFa ? "rtl" : "ltr"} className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(234,88,12,0.12)" }}>
          <Sparkles className="w-5 h-5" style={{ color: "var(--primary)" }} />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
            {tri(lang, "ایجنت‌های من", "My Agents", "Meine Agenten")}
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
            {tri(lang,
              "ایجنت‌های هوش مصنوعی که با پک صنعتی فعال شما همراه‌اند و می‌توانید همین حالا استفاده کنید.",
              "The AI agents that come with your active industry pack, ready to use right now.",
              "Die KI-Agenten, die zu Ihrem aktiven Branchenpaket gehören und sofort einsatzbereit sind.")}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
        </div>
      ) : enabledAgents.length === 0 ? (
        <div className="text-center py-16 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <Lock className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {tri(lang,
              "هنوز هیچ ایجنتی برای شما فعال نیست — یک پک صنعتی فعال کنید یا با پشتیبانی تماس بگیرید.",
              "No agents are enabled for you yet — activate an industry pack or contact support.",
              "Für Sie sind noch keine Agenten aktiviert — aktivieren Sie ein Branchenpaket oder kontaktieren Sie den Support.")}
          </p>
          <Link href="/industry" className="inline-block mt-4 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: "var(--primary)" }}>
            {tri(lang, "مشاهدهٔ بازار بسته‌ها", "Browse Industry Packs", "Branchenpakete durchsuchen")}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {enabledAgents.map((agent) => (
            <Link
              key={agent.key}
              href={agent.href || "/crm"}
              className="group p-5 rounded-2xl flex flex-col gap-2 transition-all hover:-translate-y-0.5"
              style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  {tri(lang, agent.labelFa, agent.labelEn, agent.labelDe)}
                </h3>
                <BackIcon className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--primary)" }} />
              </div>
              <p className="text-xs leading-5" style={{ color: "var(--text-secondary)" }}>
                {tri(lang, agent.descriptionFa || "", agent.descriptionEn || "", agent.descriptionDe || "")}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
