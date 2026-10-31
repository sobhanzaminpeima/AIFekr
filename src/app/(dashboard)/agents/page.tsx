"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Sparkles, ArrowLeft, ArrowRight, HeartPulse, Briefcase, Handshake, Phone,
  GraduationCap, Crown, Search, Share2, Globe, Users, Calculator, Factory, Magnet,
} from "lucide-react";
import { useTranslation, tri, type Lang } from "@/lib/i18n";
import { REAL_ESTATE_MODULES, type ModuleDefinition } from "@/lib/industry/moduleRegistry";
import { GENERAL_AGENT_CATALOG } from "@/lib/team/agentCatalog";
import { DEPARTMENTS, type DepartmentKey } from "@/lib/team/identity";

/**
 * "My Agents" hub — answers "which agents can I actually use, and where do
 * I go to use them?" Two sections:
 * 1. General-purpose agents — always available to any business account,
 *    same list/hrefs as the sidebar's "AI Agents" group (Business Doctor,
 *    CRM, Sales Agent, Voice Agent, CEO Advisor, SEO Workspace, Social
 *    Media, Website Designer, Meeting Room). Not industry-pack-gated.
 * 2. Industry-pack agents — data-driven from moduleRegistry.ts, filtered
 *    to what's actually enabled for the current user (respecting
 *    admin/customer overrides, not just "included in this pack"). Only
 *    real-estate has agents registered today; the section is simply
 *    omitted for accounts with none enabled, rather than showing an
 *    empty/locked state that reads as "you have no agents at all" when
 *    the general ones above are still fully usable.
 */

interface GeneralAgent {
  key: string;
  icon: typeof HeartPulse;
  /** Same fixed department colour the sidebar and home page use — an agent's
      tile colour is never arbitrary, it says which part of the business it belongs to. */
  department: DepartmentKey;
  labelFa: string; labelEn: string; labelDe: string;
  descriptionFa: string; descriptionEn: string; descriptionDe: string;
  href: string;
}

const AGENT_ICONS: Record<string,typeof HeartPulse> = {Briefcase, Calculator, Crown, Globe, Handshake, HeartPulse, Magnet, Phone, Search, Share2, Users};
const GENERAL_AGENTS: GeneralAgent[] = GENERAL_AGENT_CATALOG.map(agent=>({...agent,icon:AGENT_ICONS[agent.icon]??Sparkles}));

const ALL_AGENT_MODULES: ModuleDefinition[] = [...REAL_ESTATE_MODULES].filter((m) => m.category === "agent");

/**
 * Was a plain text card with no icon shown at all despite every agent
 * carrying one — a page called "My Agents" that read like a bulleted list.
 * Now each card leads with its icon in the same department-tinted tile the
 * sidebar and home page use, so the grid reads at a glance the way a team
 * roster does: colour groups agents by what part of the business they serve.
 */
function AgentCard({
  href, label, description, Icon, department, BackIcon, lang,
}: { href: string; label: string; description: string; Icon: React.ElementType; department: DepartmentKey; BackIcon: typeof ArrowLeft; lang: Lang }) {
  const dept = DEPARTMENTS[department];
  return (
    <Link href={href} className="group p-4 rounded-2xl flex items-start gap-3 transition-all hover:-translate-y-0.5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
      <span className="w-10 h-10 rounded-xl grid place-items-center flex-shrink-0" style={{ background: dept.tint, color: dept.color }}>
        <Icon className="w-5 h-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{label}</h3>
          <BackIcon className="w-4 h-4 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--primary)" }} />
        </div>
        <p className="text-xs leading-5 mt-0.5" style={{ color: "var(--text-secondary)" }}>{description}</p>
        {/* Every card on this page is something the user can open right now
            -- gated-out agents are filtered out before they ever render (see
            enabledIndustryAgents below) -- but that was never stated on the
            card itself, so "My Agents" read as a plain catalog rather than a
            list of what's actually usable. */}
        <span className="inline-flex items-center gap-1 mt-2 text-[10px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e" }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#22c55e" }} />
          {tri(lang, "فعال", "Active", "Aktiv")}
        </span>
      </div>
    </Link>
  );
}

export default function MyAgentsPage() {
  const { lang } = useTranslation();
  const isFa = lang === "fa";
  const [loading, setLoading] = useState(true);
  const [access, setAccess] = useState<Record<string, boolean>>({});
  const [agentAccess, setAgentAccess] = useState({ student: false, voice: false, business: false });

  useEffect(() => {
    void fetch("/api/home/summary", { credentials: "include" }).then(r => r.ok ? r.json() : null).then(d => { if (d?.agentAccess) setAgentAccess(d.agentAccess); }).catch(() => {});
    const keys = ALL_AGENT_MODULES.map((m) => m.key).join(",");
    fetch(`/api/crm/module-access?keys=${keys}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setAccess(d.access || {}))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const enabledIndustryAgents = ALL_AGENT_MODULES.filter((m) => access[m.key]);
  const BackIcon = isFa ? ArrowRight : ArrowLeft;

  return (
    <div dir={isFa ? "rtl" : "ltr"} className="p-6 max-w-4xl mx-auto space-y-8">
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
              "همهٔ ایجنت‌های هوش مصنوعی که می‌توانید همین حالا استفاده کنید — عمومی و مخصوص صنعت شما.",
              "Every AI agent you can use right now — general-purpose and specific to your industry.",
              "Alle KI-Agenten, die Sie sofort nutzen können — allgemein und speziell für Ihre Branche.")}
          </p>
        </div>
      </div>

      {/* General-purpose agents — always available, not industry-pack-gated */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
          {tri(lang, "ایجنت‌های عمومی", "General-Purpose Agents", "Allgemeine Agenten")}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {agentAccess.student && <AgentCard href="/student" BackIcon={BackIcon} Icon={GraduationCap} department="strategy" lang={lang} label={tri(lang, "ایجنت دانشجویی", "Student Agent", "Studierenden-Agent", "Öğrenci ajanı")} description={tri(lang, "درس‌ها، برنامهٔ مطالعه، جزوه، فلش‌کارت، آزمون و دستیار پژوهش شما.", "Your courses, study planning, materials, flashcards, quizzes and research assistant.", "Kurse, Lernplanung, Materialien, Lernkarten, Quiz und Rechercheassistent.", "Dersler, çalışma planı, materyaller, bilgi kartları, testler ve araştırma asistanı.")} />}
          {GENERAL_AGENTS.filter(a => a.key === "voice-agent" ? agentAccess.voice : agentAccess.business || a.key === "business-doctor").map((agent) => (
            <AgentCard key={agent.key} href={agent.href} BackIcon={BackIcon} Icon={agent.icon} department={agent.department} lang={lang}
              label={tri(lang, agent.labelFa, agent.labelEn, agent.labelDe)}
              description={tri(lang, agent.descriptionFa, agent.descriptionEn, agent.descriptionDe)} />
          ))}
        </div>
      </div>

      {/* Industry-pack agents — only shown once loaded, and only if the user actually has any enabled */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
        </div>
      ) : enabledIndustryAgents.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>
            {tri(lang, "ایجنت‌های پک صنعتی شما", "Your Industry Pack's Agents", "Die Agenten Ihres Branchenpakets")}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {enabledIndustryAgents.map((agent) => (
              <AgentCard key={agent.key} href={agent.href || "/crm"} BackIcon={BackIcon} Icon={Factory} department="sales" lang={lang}
                label={tri(lang, agent.labelFa, agent.labelEn, agent.labelDe)}
                description={tri(lang, agent.descriptionFa || "", agent.descriptionEn || "", agent.descriptionDe || "")} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
