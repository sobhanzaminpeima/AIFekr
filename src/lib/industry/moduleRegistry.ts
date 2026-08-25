/**
 * Static catalog of every gateable CRM module / agent in the system —
 * WHAT can be toggled, not the per-pack/per-customer STATE of whether it's
 * currently on (that lives in the IndustryModuleFlag / UserModuleOverride
 * tables, read via moduleAccess.ts). This stays in code because it's the
 * product catalog, not tenant data — adding a brand-new module to the
 * platform is a code change either way; only "is it on for pack X" is
 * meant to be admin-editable without a redeploy.
 *
 * moduleKey is the stable identifier stored in the DB rows above — never
 * rename an existing key without a migration, since it'd silently orphan
 * existing flags/overrides.
 */

export type ModuleCategory = "crm" | "agent";

export interface ModuleDefinition {
  key: string;
  category: ModuleCategory;
  labelFa: string;
  labelEn: string;
  labelDe: string;
  /** Which industry pack slug this module currently belongs to — a module can only ever be listed under packs it's registered for. */
  industrySlug: string;
  /** One-line "what does this do" — only set for agent-category modules, shown on the "My Agents" hub (/agents). */
  descriptionFa?: string;
  descriptionEn?: string;
  descriptionDe?: string;
  /** Where in the app this agent actually lives — e.g. /crm?tab=properties. Agent-category only. */
  href?: string;
}

export const REAL_ESTATE_MODULES: ModuleDefinition[] = [
  // CRM modules (بخش اول)
  { key: "crm.property", category: "crm", labelFa: "مدیریت پروژه/ملک", labelEn: "Property Management", labelDe: "Immobilienverwaltung", industrySlug: "real-estate" },
  { key: "crm.owner", category: "crm", labelFa: "مدیریت مالک/فروشنده", labelEn: "Owner Management", labelDe: "Eigentümerverwaltung", industrySlug: "real-estate" },
  { key: "crm.matchView", category: "crm", labelFa: "نمای تطبیق خریدار↔ملک", labelEn: "Buyer↔Property Match View", labelDe: "Käufer↔Immobilie-Abgleich", industrySlug: "real-estate" },
  { key: "crm.viewingScheduler", category: "crm", labelFa: "زمان‌بندی بازدید", labelEn: "Viewing Scheduler", labelDe: "Besichtigungsplaner", industrySlug: "real-estate" },
  { key: "crm.contractCommission", category: "crm", labelFa: "قرارداد و کمیسیون", labelEn: "Contract & Commission", labelDe: "Vertrag & Provision", industrySlug: "real-estate" },
  { key: "crm.shortTermCalendar", category: "crm", labelFa: "تقویم اشغال اجاره روزانه", labelEn: "Short-term Occupancy Calendar", labelDe: "Kurzzeitmiete-Belegungskalender", industrySlug: "real-estate" },
  { key: "crm.propertyDocuments", category: "crm", labelFa: "آرشیو اسناد ملک", labelEn: "Property Document Archive", labelDe: "Immobiliendokumentenarchiv", industrySlug: "real-estate" },
  { key: "crm.performanceReport", category: "crm", labelFa: "گزارش عملکرد agent/تیم", labelEn: "Agent/Team Performance Report", labelDe: "Makler-/Team-Leistungsbericht", industrySlug: "real-estate" },

  // Agents (بخش دوم)
  {
    key: "agent.leadMatcher", category: "agent", industrySlug: "real-estate",
    labelFa: "مشاور لید و تطبیق ملک", labelEn: "Lead & Property Matcher", labelDe: "Lead- & Immobilien-Matcher",
    descriptionFa: "لیدهای CRM را به‌طور خودکار با ملک‌های موجود تطبیق می‌دهد و پیش‌نویس پیام پیشنهاد می‌سازد.",
    descriptionEn: "Automatically matches your CRM leads against your existing properties and drafts a suggestion message.",
    descriptionDe: "Gleicht Ihre CRM-Leads automatisch mit vorhandenen Immobilien ab und entwirft eine Vorschlagsnachricht.",
    href: "/crm?tab=matches",
  },
  {
    key: "agent.listingCopywriter", category: "agent", industrySlug: "real-estate",
    labelFa: "دستیار تولید آگهی", labelEn: "Listing Copywriter", labelDe: "Anzeigen-Texter",
    descriptionFa: "برای هر ملک، متن آگهی مناسب اینستاگرام، دیوار یا وبسایت می‌سازد.",
    descriptionEn: "Writes ready-to-post listing copy for Instagram, Divar, or your website for any property.",
    descriptionDe: "Erstellt fertige Anzeigentexte für Instagram, Divar oder Ihre Website für jede Immobilie.",
    href: "/crm?tab=properties",
  },
  {
    key: "agent.viewingCoordinator", category: "agent", industrySlug: "real-estate",
    labelFa: "هماهنگ‌کننده بازدید", labelEn: "Viewing Coordinator", labelDe: "Besichtigungskoordinator",
    descriptionFa: "زمان بازدید بدون تداخل پیشنهاد می‌دهد و یادآوری ثبت بازخورد بازدیدهای گذشته را نشان می‌دهد.",
    descriptionEn: "Suggests a conflict-free viewing time and flags past viewings still missing feedback.",
    descriptionDe: "Schlägt eine konfliktfreie Besichtigungszeit vor und markiert vergangene Besichtigungen ohne Feedback.",
    href: "/crm?tab=viewings",
  },
  {
    key: "agent.voiceCallCenter", category: "agent", industrySlug: "real-estate",
    labelFa: "مرکز تماس هوش مصنوعی (املاک)", labelEn: "AI Call Center (Real Estate)", labelDe: "KI-Callcenter (Immobilien)",
    descriptionFa: "ایجنت صوتی که با مخاطبین تماس می‌گیرد یا پاسخ می‌دهد، با ورتیکال مخصوص املاک.",
    descriptionEn: "A voice agent that calls or answers contacts, configured for the real-estate vertical.",
    descriptionDe: "Ein Sprachagent, der Kontakte anruft oder Anrufe entgegennimmt, konfiguriert für die Immobilienbranche.",
    href: "/voice-agent",
  },
  {
    key: "agent.pricingAdvisor", category: "agent", industrySlug: "real-estate",
    labelFa: "مشاور قیمت‌گذاری", labelEn: "Pricing Advisor", labelDe: "Preisberater",
    descriptionFa: "بر اساس ملک‌های مشابه ثبت‌شده در همین آژانس، بازه قیمت پیشنهادی با دلیل ارائه می‌دهد.",
    descriptionEn: "Suggests a price range with reasoning, based on comparable properties already in your agency.",
    descriptionDe: "Schlägt anhand vergleichbarer Immobilien in Ihrer Agentur eine Preisspanne mit Begründung vor.",
    href: "/crm?tab=properties",
  },
  {
    key: "agent.agencyManager", category: "agent", industrySlug: "real-estate",
    labelFa: "دستیار مدیر آژانس", labelEn: "Agency Manager Assistant", labelDe: "Assistent der Agenturleitung",
    descriptionFa: "گزارش دوره‌ای پایپ‌لاین با سوال‌های مشخص دربارهٔ لیدهای رهاشده و بازدیدهای بی‌بازخورد می‌سازد.",
    descriptionEn: "Builds a periodic pipeline report with specific questions about abandoned leads and feedback-less viewings.",
    descriptionDe: "Erstellt einen periodischen Pipeline-Bericht mit gezielten Fragen zu verwaisten Leads und Besichtigungen ohne Feedback.",
    href: "/crm?tab=performance",
  },
];

const ALL_MODULES: ModuleDefinition[] = [...REAL_ESTATE_MODULES];

export function getModulesForIndustry(industrySlug: string): ModuleDefinition[] {
  return ALL_MODULES.filter((m) => m.industrySlug === industrySlug);
}

export function getAllModules(): ModuleDefinition[] {
  return ALL_MODULES;
}

export function getModule(moduleKey: string): ModuleDefinition | undefined {
  return ALL_MODULES.find((m) => m.key === moduleKey);
}
