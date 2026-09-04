"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Sparkles, ArrowLeft, ArrowRight, HeartPulse, Briefcase, Handshake, Phone,
  Crown, Search, Share2, Globe, Users, Calculator,
} from "lucide-react";
import { useTranslation, tri, type Lang } from "@/lib/i18n";
import { REAL_ESTATE_MODULES, type ModuleDefinition } from "@/lib/industry/moduleRegistry";

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
  labelFa: string; labelEn: string; labelDe: string;
  descriptionFa: string; descriptionEn: string; descriptionDe: string;
  href: string;
}

const GENERAL_AGENTS: GeneralAgent[] = [
  { key: "business-doctor", icon: HeartPulse, href: "/business-doctor",
    labelFa: "دکتر کسب‌وکار", labelEn: "Business Doctor", labelDe: "Geschäftsarzt",
    descriptionFa: "وضعیت کلی کسب‌وکار شما را تحلیل می‌کند و نقاط ضعف/فرصت را نشان می‌دهد.",
    descriptionEn: "Analyzes your business's overall health and surfaces weaknesses and opportunities.",
    descriptionDe: "Analysiert die allgemeine Gesundheit Ihres Unternehmens und zeigt Schwächen und Chancen auf." },
  { key: "crm", icon: Briefcase, href: "/crm",
    labelFa: "مدیریت مشتریان (CRM)", labelEn: "CRM", labelDe: "CRM",
    descriptionFa: "پایپلاین فروش، مخاطبین، اتوماسیون و دستیار تحلیل CRM.",
    descriptionEn: "Sales pipeline, contacts, automation, and the CRM analysis assistant.",
    descriptionDe: "Vertriebspipeline, Kontakte, Automatisierung und der CRM-Analyseassistent." },
  { key: "accounting", icon: Calculator, href: "/accounting",
    labelFa: "حسابداری", labelEn: "Accounting", labelDe: "Buchhaltung",
    descriptionFa: "دفتر کل، فاکتور، هزینه، حقوق و دستمزد و گزارش‌های مالی — یکپارچه با CRM.",
    descriptionEn: "General ledger, invoicing, expenses, payroll, and financial reports — integrated with CRM.",
    descriptionDe: "Hauptbuch, Rechnungsstellung, Ausgaben, Gehaltsabrechnung und Finanzberichte — integriert mit CRM." },
  { key: "sales-agent", icon: Handshake, href: "/sales",
    labelFa: "ایجنت فروش", labelEn: "Sales Agent", labelDe: "Vertriebsagent",
    descriptionFa: "پیام‌های فروش و پیگیری مشتری را برایتان پیش‌نویس می‌کند.",
    descriptionEn: "Drafts sales messages and customer follow-ups for you.",
    descriptionDe: "Entwirft für Sie Verkaufsnachrichten und Kunden-Follow-ups." },
  { key: "voice-agent", icon: Phone, href: "/voice-agent",
    labelFa: "ایجنت صوتی (تماس)", labelEn: "Voice Agent (AI Calls)", labelDe: "Sprachagent (KI-Anrufe)",
    descriptionFa: "با مخاطبین تماس می‌گیرد یا به تماس‌ها پاسخ می‌دهد.",
    descriptionEn: "Calls contacts or answers incoming calls on your behalf.",
    descriptionDe: "Ruft Kontakte an oder nimmt eingehende Anrufe für Sie entgegen." },
  { key: "ceo-advisor", icon: Crown, href: "/ceo",
    labelFa: "مشاور مدیرعامل", labelEn: "CEO Advisor", labelDe: "CEO-Berater",
    descriptionFa: "تصمیم‌های استراتژیک سطح بالا را با شما مرور می‌کند.",
    descriptionEn: "Works through high-level strategic decisions with you.",
    descriptionDe: "Bespricht mit Ihnen strategische Entscheidungen auf hoher Ebene." },
  { key: "seo-workspace", icon: Search, href: "/seo",
    labelFa: "فضای کاری سئو", labelEn: "SEO Workspace", labelDe: "SEO-Arbeitsbereich",
    descriptionFa: "کلمات کلیدی، محتوا و عملکرد سایت شما در گوگل را مدیریت می‌کند.",
    descriptionEn: "Manages your keywords, content, and Google search performance.",
    descriptionDe: "Verwaltet Ihre Keywords, Inhalte und Google-Suchleistung." },
  { key: "social-media", icon: Share2, href: "/social",
    labelFa: "شبکه‌های اجتماعی", labelEn: "Social Media", labelDe: "Social Media",
    descriptionFa: "محتوای پست و پیشنهاد فرمت‌های پرتعامل برای شبکه‌های اجتماعی می‌سازد.",
    descriptionEn: "Builds social post content and suggests high-engagement formats.",
    descriptionDe: "Erstellt Social-Media-Inhalte und schlägt engagement-starke Formate vor." },
  { key: "website-designer", icon: Globe, href: "/website-designer",
    labelFa: "طراح وبسایت", labelEn: "Website Designer", labelDe: "Website-Designer",
    descriptionFa: "برای کسب‌وکار شما یک وبسایت کامل می‌سازد.",
    descriptionEn: "Builds a complete website for your business.",
    descriptionDe: "Erstellt eine komplette Website für Ihr Unternehmen." },
  { key: "meeting-room", icon: Users, href: "/meeting",
    labelFa: "اتاق جلسات", labelEn: "Meeting Room", labelDe: "Besprechungsraum",
    descriptionFa: "چند ایجنت را هم‌زمان برای بحث روی یک موضوع جمع می‌کند.",
    descriptionEn: "Brings multiple agents together at once to discuss one topic.",
    descriptionDe: "Bringt mehrere Agenten gleichzeitig zusammen, um ein Thema zu besprechen." },
];

const ALL_AGENT_MODULES: ModuleDefinition[] = [...REAL_ESTATE_MODULES].filter((m) => m.category === "agent");

function AgentCard({ lang, href, label, description, BackIcon }: { lang: Lang; href: string; label: string; description: string; BackIcon: typeof ArrowLeft }) {
  return (
    <Link href={href} className="group p-5 rounded-2xl flex flex-col gap-2 transition-all hover:-translate-y-0.5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{label}</h3>
        <BackIcon className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "var(--primary)" }} />
      </div>
      <p className="text-xs leading-5" style={{ color: "var(--text-secondary)" }}>{description}</p>
    </Link>
  );
}

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
          {GENERAL_AGENTS.map((agent) => (
            <AgentCard key={agent.key} lang={lang} href={agent.href} BackIcon={BackIcon}
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
              <AgentCard key={agent.key} lang={lang} href={agent.href || "/crm"} BackIcon={BackIcon}
                label={tri(lang, agent.labelFa, agent.labelEn, agent.labelDe)}
                description={tri(lang, agent.descriptionFa || "", agent.descriptionEn || "", agent.descriptionDe || "")} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
