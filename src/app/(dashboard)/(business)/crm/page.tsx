"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Briefcase, Plus, X, Phone, Mail, Building2, Loader2, ChevronDown,
  Users, LayoutGrid, Clock, CheckCircle2, Circle, Zap, FileText, FileDown, Trash2, Upload, Sparkles, CalendarDays,
  Package, Receipt, FileSignature, Pin, Printer, FolderKanban, PhoneCall,
  MessageCircle, Send, BarChart2, Check, DollarSign, Tag, GitBranch, User,
} from "lucide-react";
import { useTranslation, tri, type Lang } from "@/lib/i18n";
import type { Translations } from "@/lib/i18n/en";
import { toJalali } from "@/lib/utils/jalali";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import ReactMarkdown from "react-markdown";

interface Stage { id: string; name: string; nameEn: string | null; nameDe: string | null; order: number; isWon: boolean; isLost: boolean; }
interface Pipeline { id: string; name: string; nameEn: string | null; nameDe: string | null; industrySlug: string | null; isDefault: boolean; stages: Stage[]; }

// Falls back to the Persian `name` when there's no translation (a custom
// user-typed pipeline/stage name, or a row from before this feature).
function localizedName(item: { name: string; nameEn: string | null; nameDe: string | null }, lang: Lang): string {
  return lang === "en" ? (item.nameEn || item.name) : lang === "de" ? (item.nameDe || item.name) : item.name;
}
interface DealContact { id: string; name: string; phone: string | null; company: string | null; }
interface Deal {
  id: string; title: string; value: number; stageId: string; pipelineId: string;
  status: string; contactId: string; contact: DealContact; expectedCloseDate: string | null; ownerId: string | null;
  wonAt?: string | null;
  commissionRate?: number | null; commissionAmount?: number | null; commissionPaymentStatus?: string;
}
interface Contact {
  id: string; name: string; phone: string | null; email: string | null;
  whatsapp: string | null; telegram: string | null; company: string | null;
  status: string; totalSpent: number; lastContact: string | null; assignedToId?: string | null;
  _count?: { properties: number; propertyInterests: number };
}
interface TeamMember { id: string; name: string; email: string; }
interface Activity { id: string; type: string; content: string; createdAt: string; }
interface Task { id: string; title: string; status: string; dueDate: string | null; }
interface ContactDetail extends Contact {
  deals: Deal[]; activities: Activity[]; tasks: Task[];
}
interface AutomationRule { id: string; name: string; trigger: string; condition: string | null; action: string; isActive: boolean; }
interface CrmDocument { id: string; name: string; type: string; createdAt: string; }

type CrmTab = "board" | "contacts" | "automation" | "agent" | "calendar" | "analytics" | "products" | "invoices" | "contracts" | "projects" | "properties" | "owners" | "viewings" | "matches" | "performance";

interface PropertyRow {
  id: string; title: string; listingType: string; propertyType: string;
  price: number; nightlyPrice: number | null; currency: string; bookingLink: string | null;
  address: string; city: string | null; bedrooms: number | null; bathrooms: number | null; areaSqm: number | null;
  description: string | null; images: string | null; status: string;
  representationStartDate: string | null; representationEndDate: string | null; agreedCommissionRate: number | null;
  crmContact: { id: string; name: string; phone: string | null } | null;
  crmDeal: { id: string; title: string } | null;
}

interface OwnerRow {
  id: string; name: string; phone: string | null; email: string | null;
  propertiesOwnedCount: number;
  properties: { id: string; title: string; status: string; listingType: string; address: string; city: string | null; representationStartDate: string | null; representationEndDate: string | null; agreedCommissionRate: number | null }[];
}

interface ViewingRow {
  id: string; propertyId: string; contactId: string | null; assignedToId: string | null;
  scheduledAt: string; durationMin: number; status: string; feedback: string | null; feedbackRating: number | null;
  property: { id: string; title: string; address: string };
  contact: { id: string; name: string; phone: string | null } | null;
  assignedTo: { id: string; name: string } | null;
}

const REAL_ESTATE_MODULE_KEYS = ["crm.property", "crm.owner", "crm.viewingScheduler", "crm.contractCommission", "crm.shortTermCalendar", "crm.matchView", "crm.propertyDocuments", "crm.performanceReport", "agent.leadMatcher", "agent.listingCopywriter", "agent.viewingCoordinator", "agent.pricingAdvisor", "agent.agencyManager"];

interface BuyerMatchRow {
  contactId: string; contactName: string; phone: string | null;
  criteria: { propertyType?: string; listingType?: string; city?: string; budgetMin?: number; budgetMax?: number; minBedrooms?: number };
  matches: { id: string; title: string; listingType: string; propertyType: string; price: number; city: string | null; bedrooms: number | null; address: string }[];
}

const INDUSTRY_OPTIONS: { slug: string; labelFa: string; labelEn: string }[] = [
  { slug: "real-estate", labelFa: "املاک", labelEn: "Real Estate" },
  { slug: "construction", labelFa: "ساخت‌وساز", labelEn: "Construction" },
  { slug: "clinic", labelFa: "کلینیک پزشکی", labelEn: "Clinic" },
  { slug: "restaurant", labelFa: "رستوران", labelEn: "Restaurant" },
  { slug: "university", labelFa: "دانشگاه / آموزشگاه", labelEn: "Education" },
  { slug: "ecommerce", labelFa: "فروشگاه آنلاین", labelEn: "E-commerce" },
  { slug: "law-firm", labelFa: "دفتر وکالت", labelEn: "Law Firm" },
  { slug: "hotel", labelFa: "هتل", labelEn: "Hotel" },
  { slug: "", labelFa: "عمومی (پیش‌فرض)", labelEn: "Generic (default)" },
];

function fmtMoney(n: number) {
  return new Intl.NumberFormat("fa-IR").format(n);
}

// A 401 here means the session expired mid-visit (not a recoverable
// in-page error) — send the user to log back in with a way back to
// exactly where they were, instead of leaving a bare "authentication
// required" string on screen with no path forward.
function redirectToLogin() {
  const returnTo = window.location.pathname + window.location.search;
  window.location.href = `/login?redirect=${encodeURIComponent(returnTo)}`;
}

export default function CrmPage() {
  const { t, lang } = useTranslation();
  const isFa = lang === "fa";
  const c = t.crm;

  // Supports deep-linking from outside the CRM (e.g. /crm?tab=properties from
  // the "My Agents" hub) — falls back to the default board tab otherwise.
  const [tab, setTab] = useState<CrmTab>(() => {
    if (typeof window === "undefined") return "board";
    const requested = new URLSearchParams(window.location.search).get("tab");
    const valid: CrmTab[] = ["board", "contacts", "automation", "agent", "calendar", "analytics", "products", "invoices", "contracts", "projects", "properties", "owners", "viewings", "matches", "performance"];
    return valid.includes(requested as CrmTab) ? (requested as CrmTab) : "board";
  });
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);

  const [creatingPipeline, setCreatingPipeline] = useState(false);
  const [industryChoice, setIndustryChoice] = useState("");

  const [showNewDeal, setShowNewDeal] = useState(false);
  const [showNewContact, setShowNewContact] = useState(false);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [contactDetail, setContactDetail] = useState<ContactDetail | null>(null);
  const [error, setError] = useState("");
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [crmPlan, setCrmPlan] = useState<string | null>(null);
  const [upgrading, setUpgrading] = useState(false);
  const [moduleAccess, setModuleAccess] = useState<Record<string, boolean>>({});
  // Every *Enabled flag below defaults to false until this resolves — the
  // tab-guard effects further down must wait for this before deciding a
  // requested tab (e.g. from a ?tab= deep link) is actually disabled,
  // otherwise they'd bounce back to the board tab on every load.
  const [moduleAccessLoaded, setModuleAccessLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => setCrmPlan(d.user?.crmPlan || "NONE")).catch(() => setCrmPlan("NONE"));
    fetch(`/api/crm/module-access?keys=${REAL_ESTATE_MODULE_KEYS.join(",")}`).then((r) => r.json()).then((d) => setModuleAccess(d.access || {})).catch(() => setModuleAccess({})).finally(() => setModuleAccessLoaded(true));
  }, []);
  const propertiesEnabled = !!moduleAccess["crm.property"];
  const ownersEnabled = !!moduleAccess["crm.owner"];
  const viewingsEnabled = !!moduleAccess["crm.viewingScheduler"];
  const commissionEnabled = !!moduleAccess["crm.contractCommission"];
  const shortTermCalendarEnabled = !!moduleAccess["crm.shortTermCalendar"];
  const matchViewEnabled = !!moduleAccess["crm.matchView"];
  const propertyDocumentsEnabled = !!moduleAccess["crm.propertyDocuments"];
  const performanceReportEnabled = !!moduleAccess["crm.performanceReport"];
  const leadMatcherAgentEnabled = !!moduleAccess["agent.leadMatcher"];
  const listingCopywriterEnabled = !!moduleAccess["agent.listingCopywriter"];
  const viewingCoordinatorEnabled = !!moduleAccess["agent.viewingCoordinator"];
  const pricingAdvisorEnabled = !!moduleAccess["agent.pricingAdvisor"];
  const agencyManagerEnabled = !!moduleAccess["agent.agencyManager"];

  async function purchaseCrmPlan(planCode: "CRM_SOLO" | "CRM_TEAM") {
    setUpgrading(true);
    try {
      const res = await fetch("/api/payment/create", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: planCode }),
      });
      const data = await res.json();
      if (!res.ok || !data.paymentUrl) throw new Error(data.error || c.errors.paymentStartFailed);
      window.location.href = data.paymentUrl;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : c.errors.paymentGeneric);
      setUpgrading(false);
    }
  }

  const selectedPipeline = pipelines.find((p) => p.id === selectedPipelineId) || null;

  const loadPipelines = useCallback(async () => {
    const res = await fetch("/api/crm/pipelines");
    if (res.status === 401) { redirectToLogin(); return; }
    const data = await res.json();
    setPipelines(data.pipelines || []);
    if (data.pipelines?.length && !selectedPipelineId) setSelectedPipelineId(data.pipelines[0].id);
    setLoading(false);
  }, [selectedPipelineId]);

  const loadDeals = useCallback(async (pipelineId: string) => {
    const res = await fetch(`/api/crm/deals?pipelineId=${pipelineId}`);
    const data = await res.json();
    setDeals(data.deals || []);
  }, []);

  const loadContacts = useCallback(async () => {
    const res = await fetch("/api/crm/contacts");
    const data = await res.json();
    setContacts(data.contacts || []);
  }, []);

  const loadRules = useCallback(async () => {
    const res = await fetch("/api/crm/automation-rules");
    const data = await res.json();
    setRules(data.rules || []);
  }, []);

  useEffect(() => { loadPipelines(); }, [loadPipelines]);
  useEffect(() => { if (selectedPipelineId) loadDeals(selectedPipelineId); }, [selectedPipelineId, loadDeals]);
  useEffect(() => { if (tab === "contacts" || tab === "invoices" || tab === "contracts" || tab === "projects" || tab === "properties" || tab === "owners" || tab === "viewings") loadContacts(); }, [tab, loadContacts]);
  useEffect(() => { if (moduleAccessLoaded && tab === "properties" && !propertiesEnabled) setTab("board"); }, [tab, propertiesEnabled, moduleAccessLoaded]);
  useEffect(() => { if (moduleAccessLoaded && tab === "owners" && !ownersEnabled) setTab("board"); }, [tab, ownersEnabled, moduleAccessLoaded]);
  useEffect(() => { if (moduleAccessLoaded && tab === "viewings" && !viewingsEnabled) setTab("board"); }, [tab, viewingsEnabled, moduleAccessLoaded]);
  useEffect(() => { if (moduleAccessLoaded && tab === "matches" && !matchViewEnabled) setTab("board"); }, [tab, matchViewEnabled, moduleAccessLoaded]);
  useEffect(() => { if (moduleAccessLoaded && tab === "performance" && !performanceReportEnabled) setTab("board"); }, [tab, performanceReportEnabled, moduleAccessLoaded]);
  useEffect(() => { if (tab === "automation") loadRules(); }, [tab, loadRules]);
  useEffect(() => {
    fetch("/api/team").then((r) => r.json()).then((data) => {
      setTeamMembers((data.team?.members || []).map((m: { id: string; name: string; email: string }) => ({ id: m.id, name: m.name, email: m.email })));
    }).catch(() => {});
  }, []);

  async function createPipeline() {
    setCreatingPipeline(true);
    setError("");
    try {
      const res = await fetch("/api/crm/pipelines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(industryChoice ? { industrySlug: industryChoice } : { name: c.empty.defaultPipelineName }),
      });
      if (res.status === 401) { redirectToLogin(); return; }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await loadPipelines();
      setSelectedPipelineId(data.pipeline.id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : tri(lang, "خطا", "Error", "Fehler"));
    } finally {
      setCreatingPipeline(false);
    }
  }

  async function moveDeal(dealId: string, stageId: string) {
    // Optimistic update so the card moves instantly.
    setDeals((prev) => prev.map((d) => (d.id === dealId ? { ...d, stageId } : d)));
    const res = await fetch(`/api/crm/deals/${dealId}/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stageId }),
    });
    if (!res.ok && selectedPipelineId) loadDeals(selectedPipelineId); // revert on failure
  }

  async function openContact(id: string) {
    setSelectedContactId(id);
    const res = await fetch(`/api/crm/contacts/${id}`);
    const data = await res.json();
    setContactDetail(data.contact || null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--primary)" }} />
      </div>
    );
  }

  return (
    <div dir={isFa ? "rtl" : "ltr"} className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(234,88,12,0.15)" }}>
          <Briefcase className="w-5 h-5" style={{ color: "var(--primary)" }} />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{c.header.title}</h1>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{c.header.subtitle}</p>
        </div>
      </div>

      <div className={`flex ${isFa ? "md:flex-row-reverse" : "md:flex-row"} flex-col gap-4 md:gap-6 items-start`}>
        <CrmSidebar tab={tab} setTab={setTab} c={c} isFa={isFa} lang={lang} propertiesEnabled={propertiesEnabled} ownersEnabled={ownersEnabled} viewingsEnabled={viewingsEnabled} matchViewEnabled={matchViewEnabled} performanceReportEnabled={performanceReportEnabled} />

        <div className="flex-1 min-w-0 w-full space-y-6">
      {crmPlan === "NONE" && (
        <div className="rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3" style={{ background: "rgba(234,88,12,0.08)", border: "1px solid rgba(234,88,12,0.3)" }}>
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{c.upgrade.banner}</p>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{c.upgrade.bannerSub}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => purchaseCrmPlan("CRM_SOLO")} disabled={upgrading}
              className="px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50" style={{ background: "var(--surface-1)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
              {c.upgrade.solo}
            </button>
            <button onClick={() => purchaseCrmPlan("CRM_TEAM")} disabled={upgrading}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--primary)" }}>
              {upgrading ? <Loader2 className="w-4 h-4 animate-spin" /> : c.upgrade.team}
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm" style={{ color: "#ef4444" }}>{error}</p>}

      {pipelines.length === 0 && tab === "board" ? (
        <div className="rounded-2xl p-8 text-center space-y-4" style={{ background: "var(--surface-1)", border: "1px dashed var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {c.empty.noPipeline}
          </p>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <select value={industryChoice} onChange={(e) => setIndustryChoice(e.target.value)}
              className="px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
              {INDUSTRY_OPTIONS.map((o) => <option key={o.slug} value={o.slug}>{c.industries[(o.slug || "generic") as keyof typeof c.industries]}</option>)}
            </select>
            <button onClick={createPipeline} disabled={creatingPipeline}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--primary)" }}>
              {creatingPipeline ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {c.empty.createPipeline}
            </button>
          </div>
        </div>
      ) : tab === "board" ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            {pipelines.length > 1 ? (
              <select value={selectedPipelineId || ""} onChange={(e) => setSelectedPipelineId(e.target.value)}
                className="px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                {pipelines.map((p) => <option key={p.id} value={p.id}>{localizedName(p, lang)}</option>)}
              </select>
            ) : (
              <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{selectedPipeline && localizedName(selectedPipeline, lang)}</h2>
            )}
            <div className="flex-1" />
            <a href="/api/crm/export?type=deals" download
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium" style={{ background: "var(--surface-2)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
              {c.board.exportCsv}
            </a>
            <button onClick={() => setShowNewDeal(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: "var(--primary)" }}>
              <Plus className="w-4 h-4" /> {c.board.newDeal}
            </button>
          </div>

          <BoardScrollRow>
            {selectedPipeline?.stages.sort((a, b) => a.order - b.order).map((stage) => {
              const stageDeals = deals.filter((d) => d.stageId === stage.id);
              const stageTotal = stageDeals.reduce((sum, d) => sum + d.value, 0);
              return (
                <div key={stage.id}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    const dealId = e.dataTransfer.getData("dealId");
                    if (dealId) moveDeal(dealId, stage.id);
                  }}
                  className="flex-shrink-0 w-64 rounded-2xl p-3 space-y-2"
                  style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-1.5">
                      {stage.isWon && <CheckCircle2 className="w-3.5 h-3.5" style={{ color: "#22c55e" }} />}
                      {stage.isLost && <Circle className="w-3.5 h-3.5" style={{ color: "#ef4444" }} />}
                      <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{localizedName(stage, lang)}</span>
                    </div>
                    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{stageDeals.length}</span>
                  </div>
                  {stageTotal > 0 && (
                    <p className="text-[10px] px-1" style={{ color: "var(--text-muted)" }}>{fmtMoney(stageTotal)} {c.board.currency}</p>
                  )}
                  <div className="space-y-2 min-h-[40px]">
                    {stageDeals.map((deal) => (
                      <div key={deal.id}
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData("dealId", deal.id)}
                        onClick={() => setSelectedDealId(deal.id)}
                        className="p-3 rounded-xl cursor-pointer transition-all hover:opacity-80"
                        style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                        <p className="text-xs font-medium mb-1" style={{ color: "var(--text-primary)" }}>{deal.title}</p>
                        <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{deal.contact?.name}</p>
                        {deal.value > 0 && <p className="text-[11px] mt-1" style={{ color: "var(--primary)" }}>{fmtMoney(deal.value)}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </BoardScrollRow>
        </div>
      ) : tab === "contacts" ? (
        <div className="space-y-3">
          <div className="flex justify-end gap-2">
            <a href="/api/crm/export?type=contacts" download
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium" style={{ background: "var(--surface-2)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
              {c.contacts.exportCsv}
            </a>
            <button onClick={() => setShowNewContact(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: "var(--primary)" }}>
              <Plus className="w-4 h-4" /> {c.contacts.newContact}
            </button>
          </div>
          {contacts.length === 0 ? (
            <p className="text-sm text-center py-12" style={{ color: "var(--text-muted)" }}>{c.empty.noContacts}</p>
          ) : (
            <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              {contacts.map((c, i) => (
                <button key={c.id} onClick={() => openContact(c.id)}
                  className="w-full flex items-center justify-between px-4 py-3 text-right transition-all hover:opacity-80"
                  style={{ background: "var(--surface-1)", borderTop: i > 0 ? "1px solid var(--border)" : undefined }}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "rgba(234,88,12,0.15)", color: "var(--primary)" }}>
                      {c.name.slice(0, 1)}
                    </div>
                    <div>
                      <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{c.name}</p>
                      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{c.phone || c.email || c.company || "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {propertiesEnabled && !!c._count?.properties && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: "rgba(234,88,12,0.12)", color: "var(--primary)" }}>
                        {tri(lang, `مالک ${c._count.properties} ملک`, `Owner of ${c._count.properties}`, `Eigentümer von ${c._count.properties}`)}
                      </span>
                    )}
                    {propertiesEnabled && !!c._count?.propertyInterests && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: "rgba(16,185,129,0.12)", color: "#10b981" }}>
                        {tri(lang, `علاقه‌مند به ${c._count.propertyInterests} ملک`, `Interested in ${c._count.propertyInterests}`, `Interessiert an ${c._count.propertyInterests}`)}
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                      style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>{c.status}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : tab === "automation" ? (
        <AutomationPanel isFa={isFa} t={c} rules={rules} onChanged={loadRules} />
      ) : tab === "agent" ? (
        <CrmAgentPanel isFa={isFa} t={c} />
      ) : tab === "calendar" ? (
        <CalendarPanel isFa={isFa} lang={lang} t={c} />
      ) : tab === "analytics" ? (
        <AnalyticsPanel isFa={isFa} lang={lang} t={c} pipelines={pipelines} onOpenContact={(id) => { setTab("contacts"); openContact(id); }} />
      ) : tab === "products" ? (
        <ProductsPanel isFa={isFa} t={c} />
      ) : tab === "invoices" ? (
        <InvoicesPanel isFa={isFa} lang={lang} t={c} contacts={contacts} />
      ) : tab === "contracts" ? (
        <ContractsPanel isFa={isFa} lang={lang} t={c} contacts={contacts} />
      ) : tab === "properties" && propertiesEnabled ? (
        <PropertiesPanel isFa={isFa} lang={lang} contacts={contacts} shortTermCalendarEnabled={shortTermCalendarEnabled} propertyDocumentsEnabled={propertyDocumentsEnabled} listingCopywriterEnabled={listingCopywriterEnabled} pricingAdvisorEnabled={pricingAdvisorEnabled} />
      ) : tab === "owners" && ownersEnabled ? (
        <OwnersPanel lang={lang} />
      ) : tab === "viewings" && viewingsEnabled ? (
        <ViewingsPanel lang={lang} teamMembers={teamMembers} viewingCoordinatorEnabled={viewingCoordinatorEnabled} />
      ) : tab === "matches" && matchViewEnabled ? (
        <BuyerMatchPanel lang={lang} leadMatcherAgentEnabled={leadMatcherAgentEnabled} />
      ) : tab === "performance" && performanceReportEnabled ? (
        <PerformanceReportPanel lang={lang} agencyManagerEnabled={agencyManagerEnabled} />
      ) : (
        <ProjectsPanel isFa={isFa} lang={lang} t={c} contacts={contacts} isRealEstate={pipelines.some((p) => p.industrySlug === "real-estate")} />
      )}
        </div>
      </div>

      {/* New Deal modal */}
      {showNewDeal && selectedPipeline && (
        <NewDealModal
          isFa={isFa}
          lang={lang}
          t={c}
          pipeline={selectedPipeline}
          onClose={() => setShowNewDeal(false)}
          onCreated={() => { setShowNewDeal(false); if (selectedPipelineId) loadDeals(selectedPipelineId); }}
        />
      )}

      {/* New Contact modal */}
      {showNewContact && (
        <NewContactModal isFa={isFa} lang={lang} t={c} propertiesEnabled={propertiesEnabled} onClose={() => setShowNewContact(false)} onCreated={() => { setShowNewContact(false); loadContacts(); }} />
      )}

      {/* Deal detail panel */}
      {selectedDealId && (
        <DealDetailModal
          key={selectedDealId}
          isFa={isFa}
          lang={lang}
          t={c}
          dealId={selectedDealId}
          deal={deals.find((d) => d.id === selectedDealId) || null}
          pipelines={pipelines}
          teamMembers={teamMembers}
          commissionEnabled={commissionEnabled}
          onClose={() => setSelectedDealId(null)}
          onChanged={() => { if (selectedPipelineId) loadDeals(selectedPipelineId); }}
        />
      )}

      {/* Contact detail panel */}
      {selectedContactId && contactDetail && (
        <ContactDetailModal
          key={selectedContactId}
          isFa={isFa}
          lang={lang}
          t={c}
          contact={contactDetail}
          teamMembers={teamMembers}
          onClose={() => { setSelectedContactId(null); setContactDetail(null); }}
          onChanged={() => openContact(selectedContactId)}
        />
      )}
    </div>
  );
}

function CrmSidebar({ tab, setTab, c, isFa, lang, propertiesEnabled, ownersEnabled, viewingsEnabled, matchViewEnabled, performanceReportEnabled }: { tab: CrmTab; setTab: (t: CrmTab) => void; c: Translations["crm"]; isFa: boolean; lang: Lang; propertiesEnabled: boolean; ownersEnabled: boolean; viewingsEnabled: boolean; matchViewEnabled: boolean; performanceReportEnabled: boolean }) {
  const items: { id: CrmTab; label: string; icon: React.ElementType }[] = [
    { id: "board", label: c.tabs.board, icon: LayoutGrid },
    { id: "contacts", label: c.tabs.contacts, icon: Users },
    { id: "automation", label: c.tabs.automation, icon: Zap },
    { id: "agent", label: c.tabs.agent, icon: Sparkles },
    { id: "calendar", label: c.tabs.calendar, icon: CalendarDays },
    { id: "analytics", label: c.tabs.analytics, icon: LayoutGrid },
    { id: "products", label: c.tabs.products, icon: Package },
    { id: "invoices", label: c.tabs.invoices, icon: Receipt },
    { id: "contracts", label: c.tabs.contracts, icon: FileSignature },
    { id: "projects", label: c.tabs.projects, icon: FolderKanban },
    // Real-estate industry-pack modules — hidden entirely (not greyed out)
    // unless isModuleEnabled() says so for this user, per the platform's
    // access-control rule: invisible by default, never a fail-open leak.
    ...(propertiesEnabled ? [{ id: "properties" as CrmTab, label: tri(lang, "ملک‌ها", "Properties", "Immobilien"), icon: Building2 }] : []),
    ...(ownersEnabled ? [{ id: "owners" as CrmTab, label: tri(lang, "مالکین", "Owners", "Eigentümer"), icon: Users }] : []),
    ...(viewingsEnabled ? [{ id: "viewings" as CrmTab, label: tri(lang, "زمان‌بندی بازدید", "Viewings", "Besichtigungen"), icon: CalendarDays }] : []),
    ...(matchViewEnabled ? [{ id: "matches" as CrmTab, label: tri(lang, "تطبیق خریدار↔ملک", "Buyer Match", "Käufer-Abgleich"), icon: Users }] : []),
    ...(performanceReportEnabled ? [{ id: "performance" as CrmTab, label: tri(lang, "گزارش عملکرد", "Performance", "Leistung"), icon: BarChart2 }] : []),
  ];

  return (
    <nav
      className="flex md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-1 md:pb-0 -mx-6 px-6 md:mx-0 md:px-0 w-full min-w-0 md:w-52 lg:w-56 md:flex-shrink-0 md:sticky md:top-6 flex-shrink-0"
      style={{ scrollbarWidth: "thin" }}
      aria-label={c.header.title}
    >
      {items.map((item) => {
        const active = tab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className="flex items-center gap-2 px-4 py-2.5 md:px-3.5 rounded-xl text-sm font-medium transition-all flex-shrink-0 md:w-full"
            style={{
              background: active ? "var(--primary)" : "var(--surface-1)",
              color: active ? "white" : "var(--text-secondary)",
              border: "1px solid var(--border)",
            }}
          >
            <item.icon className="w-4 h-4 flex-shrink-0" />
            <span className="whitespace-nowrap md:whitespace-normal">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function BoardScrollRow({ children }: { children: React.ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showStartFade, setShowStartFade] = useState(false);
  const [showEndFade, setShowEndFade] = useState(false);

  const updateFades = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setShowStartFade(el.scrollLeft > 4);
    setShowEndFade(el.scrollLeft < maxScroll - 4);
  }, []);

  useEffect(() => {
    updateFades();
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => updateFades();
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", updateFades);
    // Re-check after content (deal cards / stages) has rendered.
    const t = setTimeout(updateFades, 100);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", updateFades);
      clearTimeout(t);
    };
  }, [updateFades, children]);

  return (
    <div className="relative">
      <div ref={scrollRef} className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: "thin" }}>
        {children}
      </div>
      {showStartFade && (
        <div
          className="pointer-events-none absolute top-0 bottom-2 left-0 w-8"
          style={{ background: "linear-gradient(to right, var(--surface-0), transparent)" }}
        />
      )}
      {showEndFade && (
        <div
          className="pointer-events-none absolute top-0 bottom-2 right-0 w-8"
          style={{ background: "linear-gradient(to left, var(--surface-0), transparent)" }}
        />
      )}
    </div>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl p-6" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function NewDealModal({ isFa, lang, t, pipeline, onClose, onCreated }: { isFa: boolean; lang: Lang; t: Translations["crm"]; pipeline: Pipeline; onClose: () => void; onCreated: () => void }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactId, setContactId] = useState("");
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [stageId, setStageId] = useState(pipeline.stages[0]?.id || "");
  const [expectedCloseDate, setExpectedCloseDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/crm/contacts").then((r) => r.json()).then((d) => setContacts(d.contacts || []));
  }, []);

  async function submit() {
    if (!contactId || !title.trim()) { setError(t.newDealModal.errorRequired); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/crm/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId, pipelineId: pipeline.id, stageId, title: title.trim(), value: Number(value) || 0, expectedCloseDate: expectedCloseDate || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onCreated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t.newDealModal.errorGeneric);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(234,88,12,0.12)" }}>
          <Briefcase className="w-5 h-5" style={{ color: "var(--primary)" }} />
        </div>
        <h2 className="text-lg font-bold flex-1" style={{ color: "var(--text-primary)" }}>{t.newDealModal.title}</h2>
        <button onClick={onClose} className="p-1 rounded-lg hover:opacity-70"><X className="w-5 h-5" style={{ color: "var(--text-muted)" }} /></button>
      </div>
      <div className="space-y-4">
        <FormField icon={User} label={t.newDealModal.selectContact}>
          <select value={contactId} onChange={(e) => setContactId(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
            <option value="">{t.newDealModal.selectContact}</option>
            {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </FormField>
        <FormField icon={Tag} label={t.newDealModal.titlePlaceholder}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t.newDealModal.titlePlaceholder}
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
        </FormField>
        <FormField icon={DollarSign} label={t.newDealModal.valuePlaceholder}>
          <input value={value} onChange={(e) => setValue(e.target.value)} type="number" placeholder={t.newDealModal.valuePlaceholder}
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
        </FormField>
        <FormField icon={GitBranch} label={tri(lang, "مرحله", "Stage", "Phase")}>
          <select value={stageId} onChange={(e) => setStageId(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
            {pipeline.stages.sort((a, b) => a.order - b.order).map((s) => <option key={s.id} value={s.id}>{localizedName(s, lang)}</option>)}
          </select>
        </FormField>
        <FormField icon={CalendarDays} label={t.newDealModal.expectedCloseDateLabel}>
          <input type="date" value={expectedCloseDate} onChange={(e) => setExpectedCloseDate(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
        </FormField>
        {error && <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>}
        <button onClick={submit} disabled={saving} className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2 transition-opacity hover:opacity-90" style={{ background: "var(--primary)" }}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" />{t.newDealModal.submit}</>}
        </button>
      </div>
    </Modal>
  );
}

function FormField({ icon: Icon, label, children }: { icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
        <Icon className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
        {label}
      </label>
      {children}
    </div>
  );
}

const LEAD_SOURCE_OPTIONS: { value: string; fa: string; en: string }[] = [
  { value: "manual", fa: "ثبت دستی", en: "Manual entry" },
  { value: "instagram_dm", fa: "دایرکت اینستاگرام", en: "Instagram DM" },
  { value: "referral", fa: "معرفی", en: "Referral" },
  { value: "walk_in", fa: "مراجعه حضوری", en: "Walk-in" },
  { value: "website_form", fa: "فرم وبسایت", en: "Website form" },
  { value: "other", fa: "سایر", en: "Other" },
];

function NewContactModal({ isFa, lang, t, propertiesEnabled, onClose, onCreated }: { isFa: boolean; lang: Lang; t: Translations["crm"]; propertiesEnabled: boolean; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [telegram, setTelegram] = useState("");
  const [company, setCompany] = useState("");
  const [source, setSource] = useState("manual");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Real-estate relation — optional, only shown when the property module is
  // on. Lets a contact be marked as a property's owner or an interested
  // buyer/tenant right when it's created, instead of only being settable
  // from the property side.
  const [propertyRole, setPropertyRole] = useState<"" | "owner" | "interested">("");
  const [properties, setProperties] = useState<{ id: string; title: string }[]>([]);
  const [relatedPropertyId, setRelatedPropertyId] = useState("");

  useEffect(() => {
    if (propertiesEnabled && propertyRole && properties.length === 0) {
      fetch("/api/crm/properties").then((r) => r.json()).then((d) => setProperties((d.properties || []).map((p: { id: string; title: string }) => ({ id: p.id, title: p.title }))));
    }
  }, [propertiesEnabled, propertyRole, properties.length]);

  async function submit() {
    if (!name.trim()) { setError(t.newContactModal.errorNameRequired); return; }
    if (propertyRole && !relatedPropertyId) { setError(tri(lang, "یک ملک را انتخاب کنید", "Select a property", "Wählen Sie eine Immobilie")); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/crm/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phone || undefined, email: email || undefined, whatsapp: whatsapp || undefined, telegram: telegram || undefined, company: company || undefined, source }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (propertyRole === "owner" && relatedPropertyId) {
        await fetch(`/api/crm/properties/${relatedPropertyId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ crmContactId: data.contact.id }),
        });
      } else if (propertyRole === "interested" && relatedPropertyId) {
        await fetch(`/api/crm/properties/${relatedPropertyId}/interests`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contactId: data.contact.id }),
        });
      }

      onCreated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t.newContactModal.errorGeneric);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(234,88,12,0.12)" }}>
          <User className="w-5 h-5" style={{ color: "var(--primary)" }} />
        </div>
        <h2 className="text-lg font-bold flex-1" style={{ color: "var(--text-primary)" }}>{t.newContactModal.title}</h2>
        <button onClick={onClose} className="p-1 rounded-lg hover:opacity-70"><X className="w-5 h-5" style={{ color: "var(--text-muted)" }} /></button>
      </div>
      <div className="space-y-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.newContactModal.namePlaceholder}
          className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t.newContactModal.phonePlaceholder}
          className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t.newContactModal.emailPlaceholder}
          className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
        <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder={t.newContactModal.whatsappPlaceholder}
          className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
        <input value={telegram} onChange={(e) => setTelegram(e.target.value)} placeholder={t.newContactModal.telegramPlaceholder}
          className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
        <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder={t.newContactModal.companyPlaceholder}
          className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
        <div>
          <p className="text-xs font-semibold mb-1.5" style={{ color: "var(--text-primary)" }}>{t.newContactModal.sourceLabel}</p>
          <select value={source} onChange={(e) => setSource(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
            {Object.entries(t.leadSources).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        {propertiesEnabled && (
          <div className="pt-1" style={{ borderTop: "1px solid var(--border)" }}>
            <p className="text-xs font-semibold mb-1.5 mt-2" style={{ color: "var(--text-primary)" }}>
              {tri(lang, "ارتباط با ملک (اختیاری)", "Property relation (optional)", "Immobilienbezug (optional)")}
            </p>
            <select value={propertyRole} onChange={(e) => { setPropertyRole(e.target.value as typeof propertyRole); setRelatedPropertyId(""); }}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none mb-2" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
              <option value="">{tri(lang, "بدون ارتباط", "No relation", "Keine Zuordnung")}</option>
              <option value="owner">{tri(lang, "مالک ملک", "Property owner", "Immobilieneigentümer")}</option>
              <option value="interested">{tri(lang, "مشتری علاقه‌مند به ملک", "Interested buyer/tenant", "Interessierter Käufer/Mieter")}</option>
            </select>
            {propertyRole && (
              <select value={relatedPropertyId} onChange={(e) => setRelatedPropertyId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                <option value="">{tri(lang, "انتخاب ملک...", "Select property...", "Immobilie wählen...")}</option>
                {properties.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            )}
          </div>
        )}
        {error && <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>}
        <button onClick={submit} disabled={saving} className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2 transition-opacity hover:opacity-90" style={{ background: "var(--primary)" }}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" />{t.newContactModal.submit}</>}
        </button>
      </div>
    </Modal>
  );
}

function DealDetailModal({ isFa, lang, t, dealId, deal, pipelines, teamMembers, commissionEnabled, onClose, onChanged }: { isFa: boolean; lang: Lang; t: Translations["crm"]; dealId: string; deal: Deal | null; pipelines: Pipeline[]; teamMembers: TeamMember[]; commissionEnabled: boolean; onClose: () => void; onChanged: () => void }) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [ownerId, setOwnerId] = useState(deal?.ownerId || "");
  const [activities, setActivities] = useState<Activity[]>([]);
  const [commissionRate, setCommissionRate] = useState(deal?.commissionRate != null ? String(deal.commissionRate) : "");
  const [commissionAmount, setCommissionAmount] = useState(deal?.commissionAmount != null ? String(deal.commissionAmount) : "");
  const [commissionPaymentStatus, setCommissionPaymentStatus] = useState(deal?.commissionPaymentStatus || "unpaid");
  const [savingCommission, setSavingCommission] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/crm/activities?dealId=${dealId}`);
    const data = await res.json();
    setActivities(data.activities || []);
  }, [dealId]);

  useEffect(() => { load(); }, [load]);

  async function addActivity() {
    if (!note.trim()) return;
    setSaving(true);
    await fetch("/api/crm/activities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dealId, type: "note", content: note.trim() }),
    });
    setNote("");
    setSaving(false);
    load();
  }

  async function assignOwner(newOwnerId: string) {
    setOwnerId(newOwnerId);
    await fetch(`/api/crm/deals/${dealId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ownerId: newOwnerId || null }),
    });
    onChanged();
  }

  async function deleteDeal() {
    await fetch(`/api/crm/deals/${dealId}`, { method: "DELETE" });
    onChanged();
    onClose();
  }

  async function saveCommission() {
    setSavingCommission(true);
    try {
      await fetch(`/api/crm/deals/${dealId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commissionRate: commissionRate ? Number(commissionRate) : null,
          commissionAmount: commissionAmount ? Number(commissionAmount) : null,
          commissionPaymentStatus,
        }),
      });
      onChanged();
    } finally {
      setSavingCommission(false);
    }
  }

  const pipeline = pipelines.find((p) => p.id === deal?.pipelineId);
  const stage = pipeline?.stages.find((s) => s.id === deal?.stageId);

  return (
    <Modal onClose={onClose}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{deal?.title || t.dealDetail.fallbackTitle}</h2>
        <button onClick={onClose}><X className="w-5 h-5" style={{ color: "var(--text-muted)" }} /></button>
      </div>

      {deal && (
        <div className="grid grid-cols-2 gap-2 text-sm mb-4">
          <div><span style={{ color: "var(--text-muted)" }}>{tri(lang, "ارزش: ", "Value: ", "Wert: ")}</span><span style={{ color: "var(--text-primary)" }}>{fmtMoney(deal.value)}</span></div>
          <div><span style={{ color: "var(--text-muted)" }}>{tri(lang, "مرحله: ", "Stage: ", "Phase: ")}</span><span style={{ color: "var(--text-primary)" }}>{stage ? localizedName(stage, lang) : "—"}</span></div>
          <div><span style={{ color: "var(--text-muted)" }}>{tri(lang, "پایپ‌لاین: ", "Pipeline: ", "Pipeline: ")}</span><span style={{ color: "var(--text-primary)" }}>{pipeline ? localizedName(pipeline, lang) : "—"}</span></div>
          <div><span style={{ color: "var(--text-muted)" }}>{tri(lang, "وضعیت: ", "Status: ", "Status: ")}</span><span style={{ color: "var(--text-primary)" }}>{deal.status}</span></div>
          <div className="col-span-2"><span style={{ color: "var(--text-muted)" }}>{tri(lang, "مخاطب: ", "Contact: ", "Kontakt: ")}</span><span style={{ color: "var(--text-primary)" }}>{deal.contact.name}{deal.contact.phone ? ` — ${deal.contact.phone}` : ""}</span></div>
          {deal.expectedCloseDate && (
            <div className="col-span-2"><span style={{ color: "var(--text-muted)" }}>{tri(lang, "تاریخ تخمینی بستن: ", "Expected close: ", "Erwarteter Abschluss: ")}</span><span style={{ color: "var(--text-primary)" }}>{toJalali(deal.expectedCloseDate)}</span></div>
          )}
        </div>
      )}

      {/* Section 1, item 5 — Contract & Commission. Row-level visibility (relevant agent + manager only) already comes from dealAgentFilter() server-side; this UI section is additionally hidden entirely when the module is off. Deal date reuses deal.wonAt, final amount reuses deal.value — no duplicate fields. */}
      {deal && commissionEnabled && (
        <div className="rounded-2xl p-3 mb-4 space-y-2" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
          <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{tri(lang, "قرارداد و کمیسیون", "Contract & Commission", "Vertrag & Provision")}</p>
          {deal.wonAt && (
            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{tri(lang, "تاریخ معامله: ", "Deal date: ", "Abschlussdatum: ")}{toJalali(deal.wonAt)}</p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <input value={commissionRate} onChange={(e) => setCommissionRate(e.target.value)} type="number" step="0.1"
              placeholder={tri(lang, "کمیسیون %", "Commission %", "Provision %")}
              className="px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            <input value={commissionAmount} onChange={(e) => setCommissionAmount(e.target.value)} type="number"
              placeholder={tri(lang, "مبلغ کمیسیون (تومان)", "Commission amount (Toman)", "Provisionsbetrag (Toman)")}
              className="px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          </div>
          <select value={commissionPaymentStatus} onChange={(e) => setCommissionPaymentStatus(e.target.value)}
            className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
            <option value="unpaid">{tri(lang, "پرداخت‌نشده", "Unpaid", "Unbezahlt")}</option>
            <option value="partial">{tri(lang, "پرداخت جزئی", "Partially paid", "Teilweise bezahlt")}</option>
            <option value="paid">{tri(lang, "پرداخت‌شده", "Paid", "Bezahlt")}</option>
          </select>
          <button onClick={saveCommission} disabled={savingCommission} className="w-full py-1.5 rounded-xl text-xs font-medium text-white disabled:opacity-50" style={{ background: "var(--primary)" }}>
            {savingCommission ? "..." : tri(lang, "ذخیره کمیسیون", "Save commission", "Provision speichern")}
          </button>
        </div>
      )}

      <div className="space-y-3">
        {teamMembers.length > 0 && (
          <div>
            <p className="text-xs font-semibold mb-1.5" style={{ color: "var(--text-primary)" }}>{t.common.assignToTeam}</p>
            <select value={ownerId} onChange={(e) => assignOwner(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
              <option value="">{t.common.unassigned}</option>
              {teamMembers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        )}

        <div>
          <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-primary)" }}>{t.contactDetail.activity}</p>
          <div className="space-y-1.5 mb-2 max-h-40 overflow-y-auto">
            {activities.map((a) => (
              <div key={a.id} className="flex items-start gap-2 px-3 py-2 rounded-xl text-xs" style={{ background: "var(--surface-2)" }}>
                <Clock className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
                <span style={{ color: "var(--text-secondary)" }}>{a.content}</span>
              </div>
            ))}
            {activities.length === 0 && <p className="text-xs" style={{ color: "var(--text-muted)" }}>{t.contactDetail.noActivity}</p>}
          </div>
        </div>

        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder={t.dealDetail.notePlaceholder}
          className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
        <div className="flex gap-2">
          <button onClick={addActivity} disabled={saving} className="flex-1 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50" style={{ background: "var(--primary)" }}>
            {t.dealDetail.logActivity}
          </button>
          <button onClick={deleteDeal} className="px-4 py-2 rounded-xl text-sm font-medium" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
            {t.common.delete}
          </button>
        </div>
      </div>
    </Modal>
  );
}

type ContactDetailTab = "profile" | "deals" | "tasks" | "activity" | "notesFiles";

function ContactDetailModal({ isFa, lang, t, contact, teamMembers, onClose, onChanged }: { isFa: boolean; lang: Lang; t: Translations["crm"]; contact: ContactDetail; teamMembers: TeamMember[]; onClose: () => void; onChanged: () => void }) {
  const [note, setNote] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [assignedToId, setAssignedToId] = useState(contact.assignedToId || "");
  const [callingViaVoice, setCallingViaVoice] = useState(false);
  const [whatsappMessage, setWhatsappMessage] = useState("");
  const [showWhatsappInput, setShowWhatsappInput] = useState(false);
  const [tab, setTab] = useState<ContactDetailTab>("profile");
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: contact.name, phone: contact.phone || "", email: contact.email || "",
    whatsapp: contact.whatsapp || "", telegram: contact.telegram || "", company: contact.company || "",
  });
  const [savingProfile, setSavingProfile] = useState(false);

  async function saveProfile() {
    setSavingProfile(true);
    try {
      await fetch(`/api/crm/contacts/${contact.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editForm),
      });
      setEditing(false);
      onChanged();
    } finally {
      setSavingProfile(false);
    }
  }

  async function logActivity(type: string, content: string) {
    await fetch("/api/crm/activities", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId: contact.id, type, content }),
    });
    onChanged();
  }

  function sendWhatsapp() {
    if (!contact.whatsapp) return;
    const digits = contact.whatsapp.replace(/[^\d+]/g, "").replace(/^\+/, "");
    const url = `https://wa.me/${digits}${whatsappMessage.trim() ? `?text=${encodeURIComponent(whatsappMessage.trim())}` : ""}`;
    window.open(url, "_blank", "noopener,noreferrer");
    logActivity("whatsapp", t.contactDetail.whatsappActivityLog + (whatsappMessage.trim() ? `: ${whatsappMessage.trim()}` : ""));
    setWhatsappMessage("");
    setShowWhatsappInput(false);
  }

  function openTelegram() {
    if (!contact.telegram) return;
    const username = encodeURIComponent(contact.telegram.replace(/^@/, ""));
    window.open(`https://t.me/${username}`, "_blank", "noopener,noreferrer");
    logActivity("telegram", t.contactDetail.telegramActivityLog);
  }

  async function callViaVoiceAgent() {
    setCallingViaVoice(true);
    try {
      const res = await fetch("/api/crm/voice-call", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contactId: contact.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || tri(lang, "خطا در برقراری تماس", "Failed to start call", "Fehler beim Anruf"));
      onChanged();
    } catch (e) {
      alert(e instanceof Error ? e.message : tri(lang, "خطا", "Error", "Fehler"));
    } finally {
      setCallingViaVoice(false);
    }
  }

  async function assignTo(newAssigneeId: string) {
    setAssignedToId(newAssigneeId);
    await fetch(`/api/crm/contacts/${contact.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assignedToId: newAssigneeId || null }),
    });
    onChanged();
  }

  async function addActivity() {
    if (!note.trim()) return;
    await fetch("/api/crm/activities", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId: contact.id, type: "note", content: note.trim() }),
    });
    setNote("");
    onChanged();
  }

  async function addTask() {
    if (!taskTitle.trim()) return;
    await fetch("/api/crm/tasks", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId: contact.id, title: taskTitle.trim() }),
    });
    setTaskTitle("");
    onChanged();
  }

  async function toggleTask(taskId: string, status: string) {
    await fetch("/api/crm/tasks", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: taskId, status: status === "done" ? "pending" : "done" }),
    });
    onChanged();
  }

  const TABS: { id: ContactDetailTab; label: string }[] = [
    { id: "profile", label: t.contactDetail.profile },
    { id: "deals", label: t.contactDetail.deals },
    { id: "tasks", label: t.contactDetail.tasks },
    { id: "activity", label: t.contactDetail.activity },
    { id: "notesFiles", label: t.contactDetail.notesFiles },
  ];

  return (
    <Modal onClose={onClose}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{contact.name}</h2>
        <button onClick={onClose}><X className="w-5 h-5" style={{ color: "var(--text-muted)" }} /></button>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4 text-xs" style={{ color: "var(--text-secondary)" }}>
        {contact.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{contact.phone}</span>}
        {contact.email && <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{contact.email}</span>}
        {contact.whatsapp && <span className="flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" />{contact.whatsapp}</span>}
        {contact.telegram && <span className="flex items-center gap-1"><Send className="w-3.5 h-3.5" />{contact.telegram}</span>}
        {contact.company && <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" />{contact.company}</span>}
        {contact.phone && (
          <button onClick={callViaVoiceAgent} disabled={callingViaVoice}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium disabled:opacity-50"
            style={{ background: "rgba(22,163,74,0.12)", color: "#16a34a" }}>
            {callingViaVoice ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PhoneCall className="w-3.5 h-3.5" />}
            {t.contactDetail.callViaVoiceAgent}
          </button>
        )}
        {contact.whatsapp && (
          <button onClick={() => setShowWhatsappInput((v) => !v)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
            style={{ background: "rgba(37,211,102,0.12)", color: "#25d366" }}>
            <MessageCircle className="w-3.5 h-3.5" />
            {t.contactDetail.sendWhatsapp}
          </button>
        )}
        {contact.telegram && (
          <button onClick={openTelegram}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
            style={{ background: "rgba(34,158,217,0.12)", color: "#229ed9" }}>
            <Send className="w-3.5 h-3.5" />
            {t.contactDetail.openTelegram}
          </button>
        )}
      </div>

      {showWhatsappInput && contact.whatsapp && (
        <div className="flex gap-2 mb-4">
          <input value={whatsappMessage} onChange={(e) => setWhatsappMessage(e.target.value)} placeholder={t.contactDetail.whatsappMessagePlaceholder}
            className="flex-1 px-3 py-2 rounded-xl text-xs outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <button onClick={sendWhatsapp} className="px-3 py-2 rounded-xl text-xs font-medium text-white" style={{ background: "#25d366" }}>
            {t.contactDetail.sendWhatsapp}
          </button>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1.5 mb-4 pb-3" style={{ borderBottom: "1px solid var(--border)" }}>
        {TABS.map((tb) => (
          <button key={tb.id} onClick={() => setTab(tb.id)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{ background: tab === tb.id ? "var(--primary)" : "var(--surface-2)", color: tab === tb.id ? "white" : "var(--text-secondary)" }}>
            {tb.label}
          </button>
        ))}
      </div>

      {tab === "profile" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{t.contactDetail.profile}</p>
            {!editing ? (
              <button onClick={() => setEditing(true)} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
                {t.contactDetail.edit}
              </button>
            ) : (
              <div className="flex gap-1.5">
                <button onClick={saveProfile} disabled={savingProfile} className="px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50" style={{ background: "var(--primary)" }}>
                  {t.contactDetail.save}
                </button>
                <button onClick={() => { setEditing(false); setEditForm({ name: contact.name, phone: contact.phone || "", email: contact.email || "", whatsapp: contact.whatsapp || "", telegram: contact.telegram || "", company: contact.company || "" }); }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
                  {t.contactDetail.cancel}
                </button>
              </div>
            )}
          </div>

          {editing ? (
            <div className="grid grid-cols-2 gap-3">
              {([
                ["name", tri(lang, "نام", "Name", "Name")], ["phone", tri(lang, "تلفن", "Phone", "Telefon")], ["email", tri(lang, "ایمیل", "Email", "E-Mail")],
                ["whatsapp", "WhatsApp"], ["telegram", "Telegram"], ["company", tri(lang, "شرکت", "Company", "Unternehmen")],
              ] as const).map(([key, label]) => (
                <div key={key}>
                  <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>{label}</label>
                  <input value={editForm[key]} onChange={(e) => setEditForm((p) => ({ ...p, [key]: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span style={{ color: "var(--text-muted)" }}>{tri(lang, "نام: ", "Name: ", "Name: ")}</span><span style={{ color: "var(--text-primary)" }}>{contact.name}</span></div>
              <div><span style={{ color: "var(--text-muted)" }}>{tri(lang, "تلفن: ", "Phone: ", "Telefon: ")}</span><span style={{ color: "var(--text-primary)" }}>{contact.phone || "—"}</span></div>
              <div><span style={{ color: "var(--text-muted)" }}>{tri(lang, "ایمیل: ", "Email: ", "E-Mail: ")}</span><span style={{ color: "var(--text-primary)" }}>{contact.email || "—"}</span></div>
              <div><span style={{ color: "var(--text-muted)" }}>WhatsApp: </span><span style={{ color: "var(--text-primary)" }}>{contact.whatsapp || "—"}</span></div>
              <div><span style={{ color: "var(--text-muted)" }}>Telegram: </span><span style={{ color: "var(--text-primary)" }}>{contact.telegram || "—"}</span></div>
              <div><span style={{ color: "var(--text-muted)" }}>{tri(lang, "شرکت: ", "Company: ", "Unternehmen: ")}</span><span style={{ color: "var(--text-primary)" }}>{contact.company || "—"}</span></div>
            </div>
          )}

          {teamMembers.length > 0 && (
            <div>
              <p className="text-xs font-semibold mb-1.5" style={{ color: "var(--text-primary)" }}>{t.common.assignToTeam}</p>
              <select value={assignedToId} onChange={(e) => assignTo(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                <option value="">{t.common.unassigned}</option>
                {teamMembers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          )}
        </div>
      )}

      {tab === "deals" && (
        <div className="space-y-1.5">
          {contact.deals.map((d) => (
            <div key={d.id} className="flex items-center justify-between px-3 py-2 rounded-xl text-xs" style={{ background: "var(--surface-2)" }}>
              <span style={{ color: "var(--text-primary)" }}>{d.title}</span>
              <span style={{ color: "var(--text-muted)" }}>{d.status}</span>
            </div>
          ))}
          {contact.deals.length === 0 && <p className="text-xs" style={{ color: "var(--text-muted)" }}>{t.contactDetail.noActivity}</p>}
        </div>
      )}

      {tab === "tasks" && (
        <div>
          <div className="space-y-1.5 mb-2">
            {contact.tasks.map((tk) => (
              <button key={tk.id} onClick={() => toggleTask(tk.id, tk.status)} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-right" style={{ background: "var(--surface-2)" }}>
                {tk.status === "done" ? <CheckCircle2 className="w-3.5 h-3.5" style={{ color: "#22c55e" }} /> : <Circle className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />}
                <span style={{ color: tk.status === "done" ? "var(--text-muted)" : "var(--text-primary)", textDecoration: tk.status === "done" ? "line-through" : "none" }}>{tk.title}</span>
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder={t.contactDetail.newTaskPlaceholder}
              className="flex-1 px-3 py-2 rounded-xl text-xs outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            <button onClick={addTask} className="px-3 py-2 rounded-xl text-xs font-medium text-white" style={{ background: "var(--primary)" }}>+</button>
          </div>
        </div>
      )}

      {tab === "activity" && (
        <div>
          <div className="space-y-1.5 mb-2 max-h-64 overflow-y-auto">
            {contact.activities.map((a) => (
              <div key={a.id} className="flex items-start gap-2 px-3 py-2 rounded-xl text-xs" style={{ background: "var(--surface-2)" }}>
                <Clock className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
                <span style={{ color: "var(--text-secondary)" }}>{a.content}</span>
              </div>
            ))}
            {contact.activities.length === 0 && <p className="text-xs" style={{ color: "var(--text-muted)" }}>{t.contactDetail.noActivity}</p>}
          </div>
          <div className="flex gap-2">
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t.contactDetail.newNotePlaceholder}
              className="flex-1 px-3 py-2 rounded-xl text-xs outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            <button onClick={addActivity} className="px-3 py-2 rounded-xl text-xs font-medium text-white" style={{ background: "var(--primary)" }}>+</button>
          </div>
        </div>
      )}

      {tab === "notesFiles" && (
        <div>
          <PinnedNotesSection isFa={isFa} t={t} contactId={contact.id} />
          <DocumentsSection isFa={isFa} t={t} contactId={contact.id} />
        </div>
      )}
    </Modal>
  );
}

interface CrmNoteRow { id: string; content: string; isPinned: boolean; createdAt: string; }

function PinnedNotesSection({ isFa, t, contactId }: { isFa: boolean; t: Translations["crm"]; contactId: string }) {
  const [notes, setNotes] = useState<CrmNoteRow[]>([]);
  const [newNote, setNewNote] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/crm/notes?contactId=${contactId}`);
    const data = await res.json();
    setNotes(data.notes || []);
  }, [contactId]);

  useEffect(() => { load(); }, [load]);

  async function addNote() {
    if (!newNote.trim()) return;
    await fetch("/api/crm/notes", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId, content: newNote.trim() }),
    });
    setNewNote("");
    load();
  }

  async function togglePin(n: CrmNoteRow) {
    await fetch(`/api/crm/notes/${n.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isPinned: !n.isPinned }) });
    load();
  }

  async function deleteNote(id: string) {
    await fetch(`/api/crm/notes?id=${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="mt-4">
      <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-primary)" }}>{t.notes.title}</p>
      <div className="space-y-1.5 mb-2">
        {notes.map((n) => (
          <div key={n.id} className="flex items-start gap-2 px-3 py-2 rounded-xl text-xs" style={{ background: "var(--surface-2)" }}>
            <button onClick={() => togglePin(n)} className="flex-shrink-0 mt-0.5">
              <Pin className="w-3.5 h-3.5" style={{ color: n.isPinned ? "var(--primary)" : "var(--text-muted)" }} fill={n.isPinned ? "var(--primary)" : "none"} />
            </button>
            <span className="flex-1" style={{ color: "var(--text-secondary)" }}>{n.content}</span>
            <button onClick={() => deleteNote(n.id)}><Trash2 className="w-3.5 h-3.5" style={{ color: "#ef4444" }} /></button>
          </div>
        ))}
        {notes.length === 0 && <p className="text-xs" style={{ color: "var(--text-muted)" }}>{t.notes.empty}</p>}
      </div>
      <div className="flex gap-2">
        <input value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder={t.notes.placeholder}
          className="flex-1 px-3 py-2 rounded-xl text-xs outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
        <button onClick={addNote} className="px-3 py-2 rounded-xl text-xs font-medium text-white" style={{ background: "var(--primary)" }}>+</button>
      </div>
    </div>
  );
}

function DocumentsSection({ isFa, t, contactId }: { isFa: boolean; t: Translations["crm"]; contactId: string }) {
  const [documents, setDocuments] = useState<CrmDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/crm/documents?contactId=${contactId}`);
    const data = await res.json();
    setDocuments(data.documents || []);
  }, [contactId]);

  useEffect(() => { load(); }, [load]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("contactId", contactId);
      form.append("name", file.name);
      const res = await fetch("/api/crm/documents", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.documents.errorGeneric);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function removeDoc(id: string) {
    await fetch("/api/crm/documents", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    load();
  }

  return (
    <div className="mt-4">
      <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-primary)" }}>{t.documents.title}</p>
      <div className="space-y-1.5 mb-2">
        {documents.map((d) => (
          <div key={d.id} className="flex items-center justify-between px-3 py-2 rounded-xl text-xs" style={{ background: "var(--surface-2)" }}>
            <a href={`/api/crm/documents/${d.id}/download`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
              <FileText className="w-3.5 h-3.5" style={{ color: "var(--primary)" }} /> {d.name}
            </a>
            <button onClick={() => removeDoc(d.id)}><Trash2 className="w-3.5 h-3.5" style={{ color: "#ef4444" }} /></button>
          </div>
        ))}
        {documents.length === 0 && <p className="text-xs" style={{ color: "var(--text-muted)" }}>{t.documents.empty}</p>}
      </div>
      {error && <p className="text-xs mb-2" style={{ color: "#ef4444" }}>{error}</p>}
      <label className="flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium cursor-pointer"
        style={{ background: "var(--surface-2)", border: "1px dashed var(--border)", color: "var(--text-secondary)" }}>
        {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
        {uploading ? t.documents.uploading : t.documents.upload}
        <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,image/*" onChange={handleUpload} disabled={uploading} className="hidden" />
      </label>
    </div>
  );
}

function AutomationPanel({ isFa, t, rules, onChanged }: { isFa: boolean; t: Translations["crm"]; rules: AutomationRule[]; onChanged: () => void }) {
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");
  const [days, setDays] = useState("3");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function createRule() {
    if (!name.trim()) { setError(t.automation.errorNameRequired); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/crm/automation-rules", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), trigger: "stale_deal", condition: { days: Number(days) || 3 }, action: "create_task" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowNew(false);
      setName("");
      onChanged();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.automation.errorGeneric);
    } finally {
      setSaving(false);
    }
  }

  async function toggleRule(id: string, isActive: boolean) {
    await fetch(`/api/crm/automation-rules/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !isActive }),
    });
    onChanged();
  }

  async function deleteRule(id: string) {
    await fetch(`/api/crm/automation-rules/${id}`, { method: "DELETE" });
    onChanged();
  }

  return (
    <div className="space-y-3">
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        {t.automation.description}
      </p>
      <div className="flex justify-end">
        <button onClick={() => setShowNew((v) => !v)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: "var(--primary)" }}>
          <Plus className="w-4 h-4" /> {t.automation.newRule}
        </button>
      </div>

      {showNew && (
        <div className="rounded-2xl p-4 space-y-2" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.automation.namePlaceholder}
            className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{t.automation.conditionPrefix}</span>
            <input value={days} onChange={(e) => setDays(e.target.value)} type="number" min={1}
              className="w-16 px-2 py-1.5 rounded-lg text-sm outline-none text-center" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{t.automation.conditionSuffix}</span>
          </div>
          {error && <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>}
          <button onClick={createRule} disabled={saving} className="w-full py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--primary)" }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : t.automation.createRule}
          </button>
        </div>
      )}

      {rules.length === 0 ? (
        <p className="text-sm text-center py-12" style={{ color: "var(--text-muted)" }}>{t.automation.empty}</p>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          {rules.map((r, i) => {
            let days = 3;
            try { days = JSON.parse(r.condition || "{}").days || 3; } catch { /* ignore */ }
            return (
              <div key={r.id} className="flex items-center justify-between px-4 py-3" style={{ background: "var(--surface-1)", borderTop: i > 0 ? "1px solid var(--border)" : undefined }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{r.name}</p>
                  <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                    {t.automation.ruleSummaryPrefix} {days} {t.automation.ruleSummarySuffix}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleRule(r.id, r.isActive)}
                    className="px-2.5 py-1 rounded-full text-[10px] font-medium"
                    style={{ background: r.isActive ? "rgba(34,197,94,0.15)" : "var(--surface-2)", color: r.isActive ? "#22c55e" : "var(--text-muted)" }}>
                    {r.isActive ? t.automation.active : t.automation.inactive}
                  </button>
                  <button onClick={() => deleteRule(r.id)}><Trash2 className="w-4 h-4" style={{ color: "#ef4444" }} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface CrmInsightRow { id: string; category: string; text: string; createdAt: string; }

function CrmAgentPanel({ isFa, t }: { isFa: boolean; t: Translations["crm"] }) {
  const [running, setRunning] = useState(false);
  const [analysis, setAnalysis] = useState("");
  const [insights, setInsights] = useState<CrmInsightRow[]>([]);
  const [loadingInsights, setLoadingInsights] = useState(true);

  const loadInsights = useCallback(async () => {
    const res = await fetch("/api/crm/agent/insights");
    const data = await res.json();
    setInsights(data.insights || []);
    setLoadingInsights(false);
  }, []);

  useEffect(() => { loadInsights(); }, [loadInsights]);

  async function runAgent() {
    setRunning(true);
    setAnalysis("");
    try {
      const res = await fetch("/api/crm/agent/run", { method: "POST" });
      if (!res.ok) return;
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") continue;
          try {
            const evt = JSON.parse(data);
            if (evt.text) setAnalysis((p) => p + evt.text);
          } catch { /* ignore malformed chunk */ }
        }
      }
    } finally {
      setRunning(false);
      loadInsights();
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          {t.agent.description}
        </p>
        <button onClick={runAgent} disabled={running}
          className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--primary)" }}>
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {t.agent.analyzeButton}
        </button>
      </div>

      {analysis && (
        <div className="rounded-2xl p-5 prose prose-invert prose-sm max-w-none leading-7" style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
          {/* "## نکاتی برای حافظهٔ آینده" is an internal note-taking section the agent
              writes for its own future runs (parsed server-side into CrmInsight rows in
              src/lib/agents/crmAgent.ts) — it's raw "[category] text" lines never meant
              for a human reader, so strip it before display rather than showing the
              user internal bracket labels like [risk]/[general]. */}
          <ReactMarkdown>{analysis.split(/## نکاتی برای حافظهٔ آینده/)[0].trim()}</ReactMarkdown>
        </div>
      )}

      <div className="space-y-2">
        <h3 className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>{t.agent.savedNotesTitle}</h3>
        {loadingInsights ? (
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--text-muted)" }} />
        ) : insights.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>{t.agent.noAnalysis}</p>
        ) : (
          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            {insights.map((n, i) => (
              <div key={n.id} className="px-4 py-2.5 flex items-start gap-2" style={{ background: "var(--surface-1)", borderTop: i > 0 ? "1px solid var(--border)" : undefined }}>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>{n.category}</span>
                <p className="text-xs" style={{ color: "var(--text-primary)" }}>{n.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface CalendarItem { id: string; date: string; label: string; type: "task" | "deal"; }

function CalendarPanel({ isFa, lang, t }: { isFa: boolean; lang: Lang; t: Translations["crm"] }) {
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/crm/tasks?status=pending").then((r) => r.json()),
      fetch("/api/crm/deals?status=open").then((r) => r.json()),
    ]).then(([taskData, dealData]) => {
      const taskItems: CalendarItem[] = (taskData.tasks || [])
        .filter((t: Task) => t.dueDate)
        .map((t: Task) => ({ id: `task-${t.id}`, date: t.dueDate as string, label: t.title, type: "task" as const }));
      const dealItems: CalendarItem[] = (dealData.deals || [])
        .filter((d: Deal) => d.expectedCloseDate)
        .map((d: Deal) => ({ id: `deal-${d.id}`, date: d.expectedCloseDate as string, label: `${d.title} — ${d.contact?.name || ""}`, type: "deal" as const }));
      setItems([...taskItems, ...dealItems].sort((a, b) => a.date.localeCompare(b.date)));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--primary)" }} />;
  if (items.length === 0) return <p className="text-sm text-center py-12" style={{ color: "var(--text-muted)" }}>{t.calendar.empty}</p>;

  const grouped = new Map<string, CalendarItem[]>();
  for (const item of items) {
    const day = item.date.slice(0, 10);
    grouped.set(day, [...(grouped.get(day) || []), item]);
  }

  return (
    <div className="space-y-4">
      {Array.from(grouped.entries()).map(([day, dayItems]) => (
        <div key={day} className="rounded-2xl p-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <p className="text-xs font-semibold mb-2" style={{ color: "var(--primary)" }}>{tri(lang, toJalali(day), new Date(day).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }), new Date(day).toLocaleDateString("de-DE", { year: "numeric", month: "long", day: "numeric" }))}</p>
          <div className="space-y-1.5">
            {dayItems.map((item) => (
              <div key={item.id} className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs" style={{ background: "var(--surface-2)" }}>
                {item.type === "task" ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--text-muted)" }} /> : <Briefcase className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--primary)" }} />}
                <span style={{ color: "var(--text-primary)" }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function AnalyticsPanel({ isFa, lang, t, pipelines, onOpenContact }: { isFa: boolean; lang: Lang; t: Translations["crm"]; pipelines: Pipeline[]; onOpenContact: (id: string) => void }) {
  const [subTab, setSubTab] = useState<"pipeline" | "calls">("pipeline");
  const [pipelineId, setPipelineId] = useState(pipelines[0]?.id || "");
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceContacts, setSourceContacts] = useState<{ source: string; status: string }[]>([]);

  useEffect(() => {
    if (!pipelineId) { setLoading(false); return; }
    setLoading(true);
    fetch(`/api/crm/deals?pipelineId=${pipelineId}`).then((r) => r.json()).then((data) => {
      setDeals(data.deals || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [pipelineId]);

  useEffect(() => {
    fetch("/api/crm/contacts").then((r) => r.json()).then((data) => {
      setSourceContacts((data.contacts || []).map((c: { source: string; status: string }) => ({ source: c.source, status: c.status })));
    });
  }, []);

  const sourceStats = LEAD_SOURCE_OPTIONS.map((opt) => {
    const rows = sourceContacts.filter((c) => c.source === opt.value);
    const converted = rows.filter((c) => c.status === "customer").length;
    return { source: opt, total: rows.length, converted, rate: rows.length > 0 ? Math.round((converted / rows.length) * 100) : 0 };
  }).filter((s) => s.total > 0);

  const pipeline = pipelines.find((p) => p.id === pipelineId) || null;

  const subTabToggle = (
    <div className="flex gap-2">
      <button onClick={() => setSubTab("pipeline")}
        className="px-3.5 py-1.5 rounded-xl text-xs font-medium"
        style={{ background: subTab === "pipeline" ? "var(--primary)" : "var(--surface-1)", color: subTab === "pipeline" ? "white" : "var(--text-secondary)", border: "1px solid var(--border)" }}>
        {t.analytics.pipelineSubTab}
      </button>
      <button onClick={() => setSubTab("calls")}
        className="px-3.5 py-1.5 rounded-xl text-xs font-medium"
        style={{ background: subTab === "calls" ? "var(--primary)" : "var(--surface-1)", color: subTab === "calls" ? "white" : "var(--text-secondary)", border: "1px solid var(--border)" }}>
        {t.analytics.callsSubTab}
      </button>
    </div>
  );

  if (subTab === "calls") {
    return (
      <div className="space-y-4">
        {subTabToggle}
        <VoiceCallAnalyticsPanel isFa={isFa} lang={lang} t={t} onOpenContact={onOpenContact} />
      </div>
    );
  }

  if (pipelines.length === 0) return (
    <div className="space-y-4">
      {subTabToggle}
      <p className="text-sm text-center py-12" style={{ color: "var(--text-muted)" }}>{t.analytics.noPipeline}</p>
    </div>
  );

  const funnelData = pipeline
    ? [...pipeline.stages].sort((a, b) => a.order - b.order).map((s) => ({
        name: localizedName(s, lang),
        count: deals.filter((d) => d.stageId === s.id).length,
        value: deals.filter((d) => d.stageId === s.id).reduce((sum, d) => sum + d.value, 0),
      }))
    : [];

  const totalDeals = deals.length;
  const wonDeals = deals.filter((d) => d.status === "won").length;
  const overallConversion = totalDeals > 0 ? Math.round((wonDeals / totalDeals) * 100) : 0;

  return (
    <div className="space-y-4">
      {subTabToggle}
      {pipelines.length > 1 && (
        <select value={pipelineId} onChange={(e) => setPipelineId(e.target.value)}
          className="px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
          {pipelines.map((p) => <option key={p.id} value={p.id}>{localizedName(p, lang)}</option>)}
        </select>
      )}

      {loading ? (
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--primary)" }} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl p-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{t.analytics.totalDeals}</p>
              <p className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{totalDeals}</p>
            </div>
            <div className="rounded-2xl p-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{t.analytics.overallConversion}</p>
              <p className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{overallConversion}%</p>
            </div>
          </div>

          <div className="rounded-2xl p-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <p className="text-xs font-semibold mb-3" style={{ color: "var(--text-primary)" }}>{t.analytics.funnelTitle}</p>
            <div style={{ width: "100%", height: 280 }}>
              <ResponsiveContainer>
                <BarChart data={funnelData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fill: "var(--text-secondary)", fontSize: 11 }} />
                  <YAxis tick={{ fill: "var(--text-secondary)", fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="count" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {sourceStats.length > 0 && (
            <div className="rounded-2xl p-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
              <p className="text-xs font-semibold mb-3" style={{ color: "var(--text-primary)" }}>{t.analytics.sourcePerfTitle}</p>
              <div className="space-y-2">
                {sourceStats.map((s) => (
                  <div key={s.source.value} className="flex items-center justify-between px-3 py-2 rounded-xl text-xs" style={{ background: "var(--surface-2)" }}>
                    <span style={{ color: "var(--text-primary)" }}>{t.leadSources[s.source.value as keyof typeof t.leadSources]}</span>
                    <span style={{ color: "var(--text-secondary)" }}>
                      {s.total} {t.analytics.leads} · {s.converted} {t.analytics.customers} · <b style={{ color: "var(--primary)" }}>{s.rate}%</b>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface VoiceAnalyticsData {
  totalCalls: number;
  totalDurationSec: number;
  avgDurationSec: number;
  completedCalls: number;
  successRate: number;
  byStatus: { status: string; count: number }[];
  byOutcome: { outcome: string; count: number }[];
  callsPerDay: { date: string; count: number }[];
  recentCalls: {
    id: string; callerPhone: string | null; direction: string; status: string; outcome: string | null;
    durationSec: number | null; createdAt: string; contactId: string | null; contactName: string | null;
  }[];
}

function fmtDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const CALL_STATUS_COLOR: Record<string, string> = {
  completed: "#22c55e",
  in_progress: "#3b82f6",
  failed: "#ef4444",
  no_answer: "var(--text-muted)",
};

function VoiceCallAnalyticsPanel({ isFa, lang, t, onOpenContact }: { isFa: boolean; lang: Lang; t: Translations["crm"]; onOpenContact: (id: string) => void }) {
  const [data, setData] = useState<VoiceAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const tv = t.voiceAnalytics;

  useEffect(() => {
    setLoading(true);
    fetch("/api/crm/voice-analytics").then((r) => r.json()).then((d) => {
      setData(d);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--primary)" }} />;
  if (!data || data.totalCalls === 0) return <p className="text-sm text-center py-12" style={{ color: "var(--text-muted)" }}>{tv.empty}</p>;

  const totalMinutes = Math.round(data.totalDurationSec / 60);
  const maxDayCount = Math.max(1, ...data.callsPerDay.map((d) => d.count));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-2xl p-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{tv.totalCalls}</p>
          <p className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{data.totalCalls}</p>
        </div>
        <div className="rounded-2xl p-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{tv.totalMinutes}</p>
          <p className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{totalMinutes}</p>
        </div>
        <div className="rounded-2xl p-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{tv.avgDuration}</p>
          <p className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{fmtDuration(data.avgDurationSec)}</p>
        </div>
        <div className="rounded-2xl p-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{tv.successRate}</p>
          <p className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{data.successRate}%</p>
        </div>
      </div>

      <div className="rounded-2xl p-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <p className="text-xs font-semibold mb-3" style={{ color: "var(--text-primary)" }}>{tv.trendTitle}</p>
        <div className="flex items-end gap-[2px]" style={{ height: 80 }}>
          {data.callsPerDay.map((d) => (
            <div key={d.date} title={`${d.date}: ${d.count}`} className="flex-1 rounded-sm" style={{
              height: `${Math.max(2, (d.count / maxDayCount) * 80)}px`,
              background: "var(--primary)",
              opacity: d.count === 0 ? 0.2 : 0.85,
            }} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-2xl p-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <p className="text-xs font-semibold mb-3" style={{ color: "var(--text-primary)" }}>{tv.byStatusTitle}</p>
          <div className="space-y-2">
            {data.byStatus.map((s) => (
              <div key={s.status} className="flex items-center justify-between px-3 py-2 rounded-xl text-xs" style={{ background: "var(--surface-2)" }}>
                <span style={{ color: CALL_STATUS_COLOR[s.status] || "var(--text-secondary)" }}>{tv.status[s.status as keyof typeof tv.status] || s.status}</span>
                <b style={{ color: "var(--text-primary)" }}>{s.count}</b>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl p-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <p className="text-xs font-semibold mb-3" style={{ color: "var(--text-primary)" }}>{tv.byOutcomeTitle}</p>
          <div className="space-y-2">
            {data.byOutcome.map((o) => (
              <div key={o.outcome} className="flex items-center justify-between px-3 py-2 rounded-xl text-xs" style={{ background: "var(--surface-2)" }}>
                <span style={{ color: "var(--text-secondary)" }}>{tv.outcome[o.outcome as keyof typeof tv.outcome] || o.outcome}</span>
                <b style={{ color: "var(--text-primary)" }}>{o.count}</b>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <p className="text-xs font-semibold px-4 py-3" style={{ color: "var(--text-primary)", background: "var(--surface-1)" }}>{tv.recentCallsTitle}</p>
        {data.recentCalls.map((call, i) => (
          <div key={call.id} className="flex items-center justify-between px-4 py-3 flex-wrap gap-2"
            style={{ background: "var(--surface-1)", borderTop: "1px solid var(--border)" }}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "rgba(234,88,12,0.15)" }}>
                <PhoneCall className="w-3.5 h-3.5" style={{ color: "var(--primary)" }} />
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  {call.contactName || call.callerPhone || tv.unknownCaller}
                </p>
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  {call.callerPhone} · {new Date(call.createdAt).toLocaleString(tri(lang, "fa-IR", "en-US", "de-DE"))}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: "var(--surface-2)", color: CALL_STATUS_COLOR[call.status] || "var(--text-secondary)" }}>
                {tv.status[call.status as keyof typeof tv.status] || call.status}
              </span>
              {call.outcome && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
                  {tv.outcome[call.outcome as keyof typeof tv.outcome] || call.outcome}
                </span>
              )}
              <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{call.durationSec != null ? fmtDuration(call.durationSec) : "—"}</span>
              {call.contactId && (
                <button onClick={() => onOpenContact(call.contactId!)}
                  className="text-[11px] px-2 py-1 rounded-lg" style={{ background: "var(--surface-2)", color: "var(--primary)" }}>
                  {tv.viewContact}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface CrmProduct {
  id: string; name: string; sku: string | null; description: string | null;
  price: number; unit: string | null; taxRate: number; isActive: boolean; imageUrl: string | null;
}

interface ProductFormState {
  id?: string; name: string; sku: string; description: string; price: string; unit: string; taxRate: string; imageUrl: string;
}

const EMPTY_PRODUCT_FORM: ProductFormState = { name: "", sku: "", description: "", price: "", unit: "", taxRate: "0", imageUrl: "" };

function ProductsPanel({ isFa, t }: { isFa: boolean; t: Translations["crm"] }) {
  const [products, setProducts] = useState<CrmProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<ProductFormState | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [detailProduct, setDetailProduct] = useState<CrmProduct | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/crm/products");
    const data = await res.json();
    setProducts(data.products || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function uploadImage(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setForm((f) => (f ? { ...f, imageUrl: data.url } : f));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.products.errorImageUpload);
    } finally {
      setUploading(false);
    }
  }

  async function saveProduct() {
    if (!form) return;
    if (!form.name.trim()) { setError(t.products.errorNameRequired); return; }
    const priceNum = Number(form.price);
    if (!Number.isFinite(priceNum) || priceNum < 0) { setError(t.products.errorPriceRequired); return; }
    setSaving(true);
    setError("");
    try {
      const payload = {
        name: form.name.trim(), sku: form.sku.trim() || undefined, description: form.description.trim() || undefined,
        price: priceNum, unit: form.unit.trim() || undefined, taxRate: Number(form.taxRate) || 0, imageUrl: form.imageUrl || undefined,
      };
      const res = await fetch(form.id ? `/api/crm/products/${form.id}` : "/api/crm/products", {
        method: form.id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setForm(null);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.products.errorGeneric);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(p: CrmProduct) {
    await fetch(`/api/crm/products/${p.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !p.isActive }),
    });
    load();
  }

  async function deleteProduct(id: string) {
    await fetch(`/api/crm/products/${id}`, { method: "DELETE" });
    load();
  }

  if (loading) return <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--primary)" }} />;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={() => { setForm(EMPTY_PRODUCT_FORM); setError(""); }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: "var(--primary)" }}>
          <Plus className="w-4 h-4" /> {t.products.new}
        </button>
      </div>

      {form && (
        <div className="rounded-2xl p-4 space-y-2 grid grid-cols-2 gap-2" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <div className="col-span-2 flex items-center gap-3">
            <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
              {form.imageUrl ? <img src={form.imageUrl} alt="" className="w-full h-full object-cover" /> : <Package className="w-6 h-6" style={{ color: "var(--text-muted)" }} />}
            </div>
            <label className="text-xs px-3 py-1.5 rounded-lg cursor-pointer" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
              {uploading ? t.products.uploadingPhoto : t.products.uploadPhoto}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={uploading}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); }} />
            </label>
          </div>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t.products.namePlaceholder}
            className="col-span-2 px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={t.products.descriptionPlaceholder}
            className="col-span-2 px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder={t.products.skuPlaceholder}
            className="px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} type="number" placeholder={t.products.pricePlaceholder}
            className="px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder={t.products.unitPlaceholder}
            className="px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <input value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: e.target.value })} type="number" placeholder={t.products.taxPlaceholder}
            className="px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          {error && <p className="col-span-2 text-xs" style={{ color: "#ef4444" }}>{error}</p>}
          <div className="col-span-2 flex gap-2">
            <button onClick={() => setForm(null)} className="flex-1 py-2 rounded-xl text-sm font-medium" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
              {t.products.cancel}
            </button>
            <button onClick={saveProduct} disabled={saving} className="flex-1 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--primary)" }}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : t.products.save}
            </button>
          </div>
        </div>
      )}

      {products.length === 0 ? (
        <p className="text-sm text-center py-12" style={{ color: "var(--text-muted)" }}>{t.products.empty}</p>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          {products.map((p, i) => (
            <div key={p.id} className="flex items-center justify-between px-4 py-3" style={{ background: "var(--surface-1)", borderTop: i > 0 ? "1px solid var(--border)" : undefined, opacity: p.isActive ? 1 : 0.5 }}>
              <button onClick={() => setDetailProduct(p)} className="flex items-center gap-3 flex-1 text-right">
                <div className="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center" style={{ background: "var(--surface-2)" }}>
                  {p.imageUrl ? <img src={p.imageUrl} alt="" className="w-full h-full object-cover" /> : <Package className="w-4 h-4" style={{ color: "var(--text-muted)" }} />}
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{p.name}</p>
                  <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{fmtMoney(p.price)} {p.unit ? `/ ${p.unit}` : ""} {p.taxRate > 0 ? `· ${p.taxRate}% ${t.products.tax}` : ""}</p>
                </div>
              </button>
              <div className="flex items-center gap-2">
                <button onClick={() => setForm({ id: p.id, name: p.name, sku: p.sku || "", description: p.description || "", price: String(p.price), unit: p.unit || "", taxRate: String(p.taxRate), imageUrl: p.imageUrl || "" })}
                  className="text-[11px] px-2 py-1 rounded-lg" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
                  {t.products.edit}
                </button>
                <button onClick={() => toggleActive(p)}
                  className="px-2.5 py-1 rounded-full text-[10px] font-medium"
                  style={{ background: p.isActive ? "rgba(34,197,94,0.15)" : "var(--surface-2)", color: p.isActive ? "#22c55e" : "var(--text-muted)" }}>
                  {p.isActive ? t.products.active : t.products.inactive}
                </button>
                <button onClick={() => deleteProduct(p.id)}><Trash2 className="w-4 h-4" style={{ color: "#ef4444" }} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {detailProduct && <ProductDetailModal isFa={isFa} t={t} product={detailProduct} onClose={() => setDetailProduct(null)} />}
    </div>
  );
}

function ProductDetailModal({ isFa, t, product, onClose }: { isFa: boolean; t: Translations["crm"]; product: CrmProduct; onClose: () => void }) {
  const [contacts, setContacts] = useState<{ id: string; name: string }[] | null>(null);

  useEffect(() => {
    fetch(`/api/crm/products/${product.id}`).then((r) => r.json()).then((d) => setContacts(d.contacts || []));
  }, [product.id]);

  return (
    <Modal onClose={onClose}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center" style={{ background: "var(--surface-2)" }}>
          {product.imageUrl ? <img src={product.imageUrl} alt="" className="w-full h-full object-cover" /> : <Package className="w-6 h-6" style={{ color: "var(--text-muted)" }} />}
        </div>
        <div>
          <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{product.name}</h2>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{fmtMoney(product.price)} {product.unit ? `/ ${product.unit}` : ""}</p>
        </div>
      </div>
      {product.description && <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>{product.description}</p>}
      <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-primary)" }}>{t.products.detail.customersWhoBought}</p>
      {contacts === null ? (
        <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--text-muted)" }} />
      ) : contacts.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>{t.products.detail.notUsedYet}</p>
      ) : (
        <div className="space-y-1.5">
          {contacts.map((c) => (
            <div key={c.id} className="px-3 py-2 rounded-xl text-sm" style={{ background: "var(--surface-2)", color: "var(--text-primary)" }}>{c.name}</div>
          ))}
        </div>
      )}
    </Modal>
  );
}

interface InvoiceItemRow { id?: string; description: string; quantity: number; unitPrice: number; taxRate: number; lineTotal: number; productId?: string | null; }
interface CrmInvoiceRow {
  id: string; invoiceNumber: string; status: string; total: number; currency: string;
  issueDate: string; dueDate: string | null; contact: { id: string; name: string };
  subtotal: number; taxTotal: number; discount: number; notes: string | null; items: InvoiceItemRow[];
}

const INVOICE_STATUS_LABEL: Record<string, { fa: string; en: string; color: string }> = {
  draft: { fa: "پیش‌نویس", en: "Draft", color: "var(--text-muted)" },
  sent: { fa: "ارسال‌شده", en: "Sent", color: "#3b82f6" },
  paid: { fa: "پرداخت‌شده", en: "Paid", color: "#22c55e" },
  overdue: { fa: "معوق", en: "Overdue", color: "#ef4444" },
  cancelled: { fa: "لغوشده", en: "Cancelled", color: "var(--text-muted)" },
};

function InvoicesPanel({ isFa, lang, t, contacts }: { isFa: boolean; lang: Lang; t: Translations["crm"]; contacts: Contact[] }) {
  const [invoices, setInvoices] = useState<CrmInvoiceRow[]>([]);
  const [products, setProducts] = useState<CrmProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [printInvoice, setPrintInvoice] = useState<CrmInvoiceRow | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [contactId, setContactId] = useState("");
  const [items, setItems] = useState<InvoiceItemRow[]>([{ description: "", quantity: 1, unitPrice: 0, taxRate: 0, lineTotal: 0 }]);
  const [discount, setDiscount] = useState("0");

  const load = useCallback(async () => {
    const [invRes, prodRes] = await Promise.all([fetch("/api/crm/invoices"), fetch("/api/crm/products?activeOnly=1")]);
    const invData = await invRes.json();
    const prodData = await prodRes.json();
    setInvoices(invData.invoices || []);
    setProducts(prodData.products || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function updateItem(idx: number, patch: Partial<InvoiceItemRow>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function pickProduct(idx: number, productId: string) {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    updateItem(idx, { description: p.name, unitPrice: p.price, taxRate: p.taxRate, productId: p.id });
  }

  const subtotal = items.reduce((sum, it) => sum + it.quantity * it.unitPrice, 0);
  const taxTotal = items.reduce((sum, it) => sum + it.quantity * it.unitPrice * (it.taxRate / 100), 0);
  const total = Math.max(0, subtotal + taxTotal - (Number(discount) || 0));

  async function createInvoice() {
    if (!contactId) { setError(t.invoices.errorContactRequired); return; }
    if (items.some((it) => !it.description.trim())) { setError(t.invoices.errorItemDescriptionRequired); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/crm/invoices", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId, items, discount: Number(discount) || 0 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowNew(false);
      setContactId(""); setItems([{ description: "", quantity: 1, unitPrice: 0, taxRate: 0, lineTotal: 0 }]); setDiscount("0");
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.invoices.errorGeneric);
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(id: string, status: string) {
    await fetch(`/api/crm/invoices/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    load();
  }

  async function deleteInvoice(id: string) {
    await fetch(`/api/crm/invoices/${id}`, { method: "DELETE" });
    load();
  }

  if (loading) return <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--primary)" }} />;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={() => setShowNew((v) => !v)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: "var(--primary)" }}>
          <Plus className="w-4 h-4" /> {t.invoices.new}
        </button>
      </div>

      {showNew && (
        <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <select value={contactId} onChange={(e) => setContactId(e.target.value)}
            className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
            <option value="">{t.invoices.selectContact}</option>
            {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <div className="space-y-2">
            {items.map((it, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-1.5 items-center">
                <select onChange={(e) => e.target.value && pickProduct(idx, e.target.value)} defaultValue=""
                  className="col-span-3 px-2 py-1.5 rounded-lg text-xs outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                  <option value="">{t.invoices.fromCatalog}</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <input value={it.description} onChange={(e) => updateItem(idx, { description: e.target.value })} placeholder={t.invoices.itemDescription}
                  className="col-span-4 px-2 py-1.5 rounded-lg text-xs outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                <input value={it.quantity} onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) || 1 })} type="number" placeholder={t.invoices.qty}
                  className="col-span-2 px-2 py-1.5 rounded-lg text-xs outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                <input value={it.unitPrice} onChange={(e) => updateItem(idx, { unitPrice: Number(e.target.value) || 0 })} type="number" placeholder={t.invoices.unitPrice}
                  className="col-span-2 px-2 py-1.5 rounded-lg text-xs outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                <button onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))} className="col-span-1"><Trash2 className="w-3.5 h-3.5" style={{ color: "#ef4444" }} /></button>
              </div>
            ))}
            <button onClick={() => setItems((prev) => [...prev, { description: "", quantity: 1, unitPrice: 0, taxRate: 0, lineTotal: 0 }])}
              className="text-xs" style={{ color: "var(--primary)" }}>+ {t.invoices.addItem}</button>
          </div>

          <div className="flex items-center justify-between text-xs" style={{ color: "var(--text-secondary)" }}>
            <div className="flex items-center gap-1.5">
              <span>{t.invoices.discount}</span>
              <input value={discount} onChange={(e) => setDiscount(e.target.value)} type="number"
                className="w-24 px-2 py-1 rounded-lg text-xs outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            </div>
            <span>{t.invoices.total} <b style={{ color: "var(--text-primary)" }}>{fmtMoney(total)}</b></span>
          </div>

          {error && <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>}
          <button onClick={createInvoice} disabled={saving} className="w-full py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--primary)" }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : t.invoices.createInvoice}
          </button>
        </div>
      )}

      {invoices.length === 0 ? (
        <p className="text-sm text-center py-12" style={{ color: "var(--text-muted)" }}>{t.invoices.empty}</p>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          {invoices.map((inv, i) => {
            const st = INVOICE_STATUS_LABEL[inv.status] || INVOICE_STATUS_LABEL.draft;
            return (
              <div key={inv.id} className="flex items-center justify-between px-4 py-3 flex-wrap gap-2" style={{ background: "var(--surface-1)", borderTop: i > 0 ? "1px solid var(--border)" : undefined }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{inv.invoiceNumber} — {inv.contact.name}</p>
                  <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{fmtMoney(inv.total)} {t.invoices.currency}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-medium" style={{ background: "var(--surface-2)", color: st.color }}>{t.invoiceStatus[inv.status as keyof typeof t.invoiceStatus] || t.invoiceStatus.draft}</span>
                  {inv.status === "draft" && <button onClick={() => setStatus(inv.id, "sent")} className="text-[11px] px-2 py-1 rounded-lg" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>{t.invoices.send}</button>}
                  {inv.status !== "paid" && inv.status !== "cancelled" && <button onClick={() => setStatus(inv.id, "paid")} className="text-[11px] px-2 py-1 rounded-lg" style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e" }}>{t.invoices.markPaid}</button>}
                  <button onClick={() => setPrintInvoice(inv)}><Printer className="w-4 h-4" style={{ color: "var(--text-secondary)" }} /></button>
                  <button onClick={() => deleteInvoice(inv.id)}><Trash2 className="w-4 h-4" style={{ color: "#ef4444" }} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {printInvoice && <InvoicePrintModal isFa={isFa} lang={lang} t={t} invoice={printInvoice} onClose={() => setPrintInvoice(null)} />}
    </div>
  );
}

function InvoicePrintModal({ isFa, lang, t, invoice, onClose }: { isFa: boolean; lang: Lang; t: Translations["crm"]; invoice: CrmInvoiceRow; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:p-0 print:static" style={{ background: "rgba(0,0,0,0.6)" }}>
      <div className="print:hidden absolute top-4 left-4 flex gap-2">
        <button onClick={() => window.print()} className="px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: "var(--primary)" }}>{t.invoices.print.printPdf}</button>
        <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium" style={{ background: "var(--surface-2)", color: "var(--text-primary)" }}>{t.invoices.print.close}</button>
      </div>
      <div dir={isFa ? "rtl" : "ltr"} className="w-full max-w-xl rounded-2xl p-8 space-y-4 max-h-[85vh] overflow-y-auto print:max-h-none print:overflow-visible print:shadow-none print:rounded-none"
        style={{ background: "#fff", color: "#111" }}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{t.invoices.print.invoiceTitle} {invoice.invoiceNumber}</h2>
          <span className="text-xs">{lang === "fa" ? toJalali(invoice.issueDate) : new Date(invoice.issueDate).toLocaleDateString(lang === "de" ? "de-DE" : "en-US")}</span>
        </div>
        <p className="text-sm">{t.invoices.print.billTo} {invoice.contact.name}</p>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr style={{ borderBottom: "1px solid #ddd" }}>
              <th className="text-right py-1">{t.invoices.print.description}</th>
              <th className="text-right py-1">{t.invoices.print.qty}</th>
              <th className="text-right py-1">{t.invoices.print.unit}</th>
              <th className="text-right py-1">{t.invoices.print.total}</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((it, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
                <td className="py-1">{it.description}</td>
                <td className="py-1">{it.quantity}</td>
                <td className="py-1">{fmtMoney(it.unitPrice)}</td>
                <td className="py-1">{fmtMoney(it.quantity * it.unitPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="text-sm space-y-1 text-left">
          <p>{t.invoices.print.subtotal} {fmtMoney(invoice.subtotal)}</p>
          <p>{t.invoices.print.tax} {fmtMoney(invoice.taxTotal)}</p>
          {invoice.discount > 0 && <p>{t.invoices.print.discount} -{fmtMoney(invoice.discount)}</p>}
          <p className="font-bold text-base">{t.invoices.print.grandTotal} {fmtMoney(invoice.total)} {invoice.currency}</p>
        </div>
      </div>
    </div>
  );
}

interface CrmContractRow {
  id: string; title: string; status: string; content: string; createdAt: string;
  contact: { id: string; name: string }; signedAt: string | null;
}
interface CrmContractTemplateRow { id: string; name: string; content: string; }

const CONTRACT_STATUS_LABEL: Record<string, { fa: string; en: string; color: string }> = {
  draft: { fa: "پیش‌نویس", en: "Draft", color: "var(--text-muted)" },
  sent: { fa: "ارسال‌شده", en: "Sent", color: "#3b82f6" },
  signed: { fa: "امضاشده", en: "Signed", color: "#22c55e" },
  cancelled: { fa: "لغوشده", en: "Cancelled", color: "var(--text-muted)" },
};

function ContractsPanel({ isFa, lang, t, contacts }: { isFa: boolean; lang: Lang; t: Translations["crm"]; contacts: Contact[] }) {
  const [contracts, setContracts] = useState<CrmContractRow[]>([]);
  const [templates, setTemplates] = useState<CrmContractTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [printContract, setPrintContract] = useState<CrmContractRow | null>(null);
  const [editingContract, setEditingContract] = useState<CrmContractRow | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [restoringDefaults, setRestoringDefaults] = useState(false);

  const [contactId, setContactId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<CrmContractTemplateRow | null>(null);

  async function saveTemplateEdit(newName: string, newContent: string) {
    if (!editingTemplate) return;
    await fetch(`/api/crm/contract-templates/${editingTemplate.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newName, content: newContent }),
    });
    setEditingTemplate(null);
    load();
  }

  async function deleteTemplate(id: string) {
    await fetch(`/api/crm/contract-templates/${id}`, { method: "DELETE" });
    load();
  }

  async function restoreDefaultTemplates() {
    setRestoringDefaults(true);
    try {
      await fetch("/api/crm/contract-templates/seed-defaults", { method: "POST" });
      load();
    } finally {
      setRestoringDefaults(false);
    }
  }

  async function saveEditedContract(newContent: string) {
    if (!editingContract) return;
    await fetch(`/api/crm/contracts/${editingContract.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: newContent }),
    });
    setEditingContract(null);
    load();
  }

  const load = useCallback(async () => {
    const [cRes, tRes] = await Promise.all([fetch("/api/crm/contracts"), fetch("/api/crm/contract-templates")]);
    const cData = await cRes.json();
    const tData = await tRes.json();
    setContracts(cData.contracts || []);
    setTemplates(tData.templates || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createContract() {
    if (!contactId || !title.trim()) { setError(t.contracts.errorRequired); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/crm/contracts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId, templateId: templateId || undefined, title: title.trim(), content: templateId ? undefined : content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowNew(false);
      setContactId(""); setTemplateId(""); setTitle(""); setContent("");
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.contracts.errorGeneric);
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(id: string, status: string) {
    await fetch(`/api/crm/contracts/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    load();
  }

  async function deleteContract(id: string) {
    await fetch(`/api/crm/contracts/${id}`, { method: "DELETE" });
    load();
  }

  if (loading) return <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--primary)" }} />;

  return (
    <div className="space-y-3">
      <div className="flex justify-end gap-2">
        <button onClick={restoreDefaultTemplates} disabled={restoringDefaults}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50" style={{ background: "var(--surface-2)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
          {restoringDefaults ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {t.contracts.restoreDefaults}
        </button>
        <button onClick={() => setShowTemplates((v) => !v)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium" style={{ background: "var(--surface-2)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
          <FileSignature className="w-4 h-4" /> {t.contracts.manageTemplates}
        </button>
        <button onClick={() => setShowNew((v) => !v)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: "var(--primary)" }}>
          <Plus className="w-4 h-4" /> {t.contracts.newContract}
        </button>
      </div>

      {showNew && (
        <div className="rounded-2xl p-4 space-y-2" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <p className="text-[11px] p-2 rounded-lg" style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>
            {t.contracts.legalDisclaimer}
          </p>
          <select value={contactId} onChange={(e) => setContactId(e.target.value)}
            className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
            <option value="">{t.contracts.selectContact}</option>
            {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t.contracts.titlePlaceholder}
            className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}
            className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
            <option value="">{t.contracts.noTemplate}</option>
            {templates.map((tpl) => <option key={tpl.id} value={tpl.id}>{tpl.name}</option>)}
          </select>
          {!templateId && (
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={5} placeholder={t.contracts.contentPlaceholder}
              className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          )}
          {error && <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>}
          <button onClick={createContract} disabled={saving} className="w-full py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--primary)" }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : t.contracts.createContract}
          </button>
        </div>
      )}

      {showTemplates && (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          {templates.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>{t.contracts.noTemplatesYet}</p>
          ) : (
            templates.map((tpl, i) => (
              <div key={tpl.id} className="flex items-center justify-between px-4 py-3" style={{ background: "var(--surface-1)", borderTop: i > 0 ? "1px solid var(--border)" : undefined }}>
                <p className="text-sm" style={{ color: "var(--text-primary)" }}>{tpl.name}</p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setEditingTemplate(tpl)} className="text-[11px] px-2 py-1 rounded-lg" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>{t.contracts.edit}</button>
                  <button onClick={() => deleteTemplate(tpl.id)}><Trash2 className="w-4 h-4" style={{ color: "#ef4444" }} /></button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {contracts.length === 0 ? (
        <p className="text-sm text-center py-12" style={{ color: "var(--text-muted)" }}>{t.contracts.empty}</p>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          {contracts.map((ct, i) => {
            const st = CONTRACT_STATUS_LABEL[ct.status] || CONTRACT_STATUS_LABEL.draft;
            return (
              <div key={ct.id} className="flex items-center justify-between px-4 py-3 flex-wrap gap-2" style={{ background: "var(--surface-1)", borderTop: i > 0 ? "1px solid var(--border)" : undefined }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{ct.title} — {ct.contact.name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-medium" style={{ background: "var(--surface-2)", color: st.color }}>{t.contractStatus[ct.status as keyof typeof t.contractStatus] || t.contractStatus.draft}</span>
                  {ct.status === "draft" && <button onClick={() => setStatus(ct.id, "sent")} className="text-[11px] px-2 py-1 rounded-lg" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>{t.contracts.send}</button>}
                  {ct.status !== "signed" && ct.status !== "cancelled" && <button onClick={() => setStatus(ct.id, "signed")} className="text-[11px] px-2 py-1 rounded-lg" style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e" }}>{t.contracts.markSigned}</button>}
                  <button onClick={() => setEditingContract(ct)} className="text-[11px] px-2 py-1 rounded-lg" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>{t.contracts.edit}</button>
                  <button onClick={() => setPrintContract(ct)}><Printer className="w-4 h-4" style={{ color: "var(--text-secondary)" }} /></button>
                  <button onClick={() => deleteContract(ct.id)}><Trash2 className="w-4 h-4" style={{ color: "#ef4444" }} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {printContract && <ContractPrintModal isFa={isFa} t={t} contract={printContract} onClose={() => setPrintContract(null)} />}
      {editingContract && (
        <ContractEditModal isFa={isFa} t={t} contract={editingContract} onClose={() => setEditingContract(null)} onSave={saveEditedContract} />
      )}
      {editingTemplate && (
        <TemplateEditModal isFa={isFa} t={t} template={editingTemplate} onClose={() => setEditingTemplate(null)} onSave={saveTemplateEdit} />
      )}
    </div>
  );
}

function ContractPrintModal({ isFa, t, contract, onClose }: { isFa: boolean; t: Translations["crm"]; contract: CrmContractRow; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:p-0 print:static" style={{ background: "rgba(0,0,0,0.6)" }}>
      <div className="print:hidden absolute top-4 left-4 flex gap-2">
        <button onClick={() => window.print()} className="px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: "var(--primary)" }}>{t.contracts.print.printPdf}</button>
        <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium" style={{ background: "var(--surface-2)", color: "var(--text-primary)" }}>{t.contracts.print.close}</button>
      </div>
      <div dir={isFa ? "rtl" : "ltr"} className="w-full max-w-xl rounded-2xl p-8 space-y-4 max-h-[85vh] overflow-y-auto print:max-h-none print:overflow-visible print:shadow-none print:rounded-none whitespace-pre-wrap"
        style={{ background: "#fff", color: "#111" }}>
        <h2 className="text-lg font-bold">{contract.title}</h2>
        <p className="text-xs">{t.contracts.print.contact} {contract.contact.name}</p>
        <div className="text-sm leading-7">{contract.content}</div>
      </div>
    </div>
  );
}

function ContractEditModal({ isFa, t, contract, onClose, onSave }: { isFa: boolean; t: Translations["crm"]; contract: CrmContractRow; onClose: () => void; onSave: (content: string) => void }) {
  const [content, setContent] = useState(contract.content);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await onSave(content);
    setSaving(false);
  }

  return (
    <Modal onClose={onClose}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{t.contracts.editModal.title}</h2>
        <button onClick={onClose}><X className="w-5 h-5" style={{ color: "var(--text-muted)" }} /></button>
      </div>
      {contract.status !== "draft" && (
        <p className="text-[11px] p-2 rounded-lg mb-2" style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>
          {t.contracts.editModal.finalizedNotice}
        </p>
      )}
      <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={12}
        className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
      <button onClick={handleSave} disabled={saving} className="w-full mt-3 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--primary)" }}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : t.contracts.editModal.save}
      </button>
    </Modal>
  );
}

function TemplateEditModal({ isFa, t, template, onClose, onSave }: { isFa: boolean; t: Translations["crm"]; template: CrmContractTemplateRow; onClose: () => void; onSave: (name: string, content: string) => void }) {
  const [name, setName] = useState(template.name);
  const [content, setContent] = useState(template.content);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await onSave(name, content);
    setSaving(false);
  }

  return (
    <Modal onClose={onClose}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{t.contracts.templateEditModal.title}</h2>
        <button onClick={onClose}><X className="w-5 h-5" style={{ color: "var(--text-muted)" }} /></button>
      </div>
      <p className="text-[11px] p-2 rounded-lg mb-2" style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>
        {t.contracts.templateEditModal.legalDisclaimer}
      </p>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.contracts.templateEditModal.namePlaceholder}
        className="w-full px-3 py-2 rounded-xl text-sm outline-none mb-2" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
      <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={12}
        className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
      <button onClick={handleSave} disabled={saving} className="w-full mt-3 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--primary)" }}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : t.contracts.templateEditModal.save}
      </button>
    </Modal>
  );
}

interface ProjectProperty {
  id: string; listingType: string; propertyType: string; price: number; nightlyPrice: number | null;
  bookingLink: string | null; address: string; city: string | null; areaSqm: number | null;
}
interface CrmProjectRow {
  id: string; name: string; status: string; description: string | null;
  startDate: string | null; endDate: string | null;
  contact: { id: string; name: string } | null; deal: { id: string; title: string } | null;
  property: ProjectProperty | null;
}

const PROJECT_LISTING_TYPE_LABEL: Record<string, { fa: string; en: string; de: string }> = {
  sell: { fa: "فروش", en: "Sale", de: "Verkauf" },
  rent: { fa: "اجاره", en: "Rent", de: "Miete" },
  short_term_rent: { fa: "اجاره روزانه", en: "Short-term rental", de: "Kurzzeitvermietung" },
};

const PROJECT_STATUS_LABEL: Record<string, { fa: string; en: string; color: string }> = {
  active: { fa: "در حال انجام", en: "Active", color: "#3b82f6" },
  on_hold: { fa: "متوقف‌شده", en: "On Hold", color: "#f59e0b" },
  completed: { fa: "تکمیل‌شده", en: "Completed", color: "#22c55e" },
  cancelled: { fa: "لغوشده", en: "Cancelled", color: "var(--text-muted)" },
};

/** Generic post-sale/ongoing-work tracking — usable by any vertical (a construction job, a real-estate closing's paperwork, a service engagement), not tied to one industry's schema. */
function ProjectsPanel({ isFa, lang, t, contacts, isRealEstate }: { isFa: boolean; lang: Lang; t: Translations["crm"]; contacts: Contact[]; isRealEstate: boolean }) {
  const [projects, setProjects] = useState<CrmProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [contactId, setContactId] = useState("");
  const [description, setDescription] = useState("");

  // Real-estate industry pack only — conditional fields per deal type, all
  // stored on the linked Property row (see api/crm/projects), never on
  // CrmProject itself, so a non-real-estate customer's schema/UI is
  // completely unaffected.
  const [dealType, setDealType] = useState("");
  const [propertyType, setPropertyType] = useState("apartment");
  const [reAddress, setReAddress] = useState("");
  const [reCity, setReCity] = useState("");
  const [price, setPrice] = useState("");
  const [nightlyPrice, setNightlyPrice] = useState("");
  const [bookingLink, setBookingLink] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/crm/projects");
    const data = await res.json();
    setProjects(data.projects || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createProject() {
    if (!name.trim()) { setError(t.projects.errorNameRequired); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/crm/projects", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(), contactId: contactId || undefined, description: description.trim() || undefined,
          realEstate: isRealEstate && dealType ? {
            dealType, propertyType, address: reAddress.trim(), city: reCity.trim() || undefined,
            price: dealType !== "short_term_rent" ? price : undefined,
            nightlyPrice: dealType === "short_term_rent" ? nightlyPrice : undefined,
            bookingLink: bookingLink.trim() || undefined,
          } : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.bookingLinkWarning) alert(data.bookingLinkWarning);
      setShowNew(false);
      setName(""); setContactId(""); setDescription("");
      setDealType(""); setPropertyType("apartment"); setReAddress(""); setReCity(""); setPrice(""); setNightlyPrice(""); setBookingLink("");
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.projects.errorGeneric);
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(id: string, status: string) {
    await fetch(`/api/crm/projects/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    load();
  }

  async function deleteProject(id: string) {
    await fetch(`/api/crm/projects/${id}`, { method: "DELETE" });
    load();
  }

  if (loading) return <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--primary)" }} />;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={() => setShowNew((v) => !v)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: "var(--primary)" }}>
          <Plus className="w-4 h-4" /> {t.projects.new}
        </button>
      </div>

      {showNew && (
        <div className="rounded-2xl p-4 space-y-2" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.projects.namePlaceholder}
            className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <select value={contactId} onChange={(e) => setContactId(e.target.value)}
            className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
            <option value="">{t.projects.noContact}</option>
            {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder={t.projects.descriptionPlaceholder}
            className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />

          {isRealEstate && (
            <div className="pt-2 space-y-2" style={{ borderTop: "1px solid var(--border)" }}>
              <select value={dealType} onChange={(e) => setDealType(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                <option value="">{tri(lang, "نوع معامله (اختیاری)", "Deal type (optional)", "Geschäftsart (optional)")}</option>
                {Object.entries(PROJECT_LISTING_TYPE_LABEL).map(([val, l]) => <option key={val} value={val}>{l[lang]}</option>)}
              </select>

              {dealType && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <select value={propertyType} onChange={(e) => setPropertyType(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                      <option value="apartment">{tri(lang, "آپارتمان", "Apartment", "Wohnung")}</option>
                      <option value="villa">{tri(lang, "ویلا", "Villa", "Villa")}</option>
                      <option value="land">{tri(lang, "زمین", "Land", "Grundstück")}</option>
                      <option value="commercial">{tri(lang, "تجاری", "Commercial", "Gewerbe")}</option>
                    </select>
                    <input value={reCity} onChange={(e) => setReCity(e.target.value)} placeholder={tri(lang, "شهر", "City", "Stadt")}
                      className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                  </div>
                  <input value={reAddress} onChange={(e) => setReAddress(e.target.value)} placeholder={tri(lang, "آدرس", "Address", "Adresse")}
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />

                  {dealType === "short_term_rent" ? (
                    <>
                      <input value={nightlyPrice} onChange={(e) => setNightlyPrice(e.target.value)} type="number" placeholder={tri(lang, "قیمت هر شب (تومان)", "Price per night (Toman)", "Preis pro Nacht (Toman)")}
                        className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                      <input value={bookingLink} onChange={(e) => setBookingLink(e.target.value)} placeholder={tri(lang, "لینک پلتفرم رزرو (Airbnb، Booking.com و...)", "Booking platform link (Airbnb, Booking.com, ...)", "Buchungsplattform-Link (Airbnb, Booking.com, ...)")}
                        className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                    </>
                  ) : (
                    <input value={price} onChange={(e) => setPrice(e.target.value)} type="number" placeholder={tri(lang, "قیمت کل (تومان)", "Total price (Toman)", "Gesamtpreis (Toman)")}
                      className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                  )}
                </>
              )}
            </div>
          )}

          {error && <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>}
          <button onClick={createProject} disabled={saving} className="w-full py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--primary)" }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : t.projects.createProject}
          </button>
        </div>
      )}

      {projects.length === 0 ? (
        <p className="text-sm text-center py-12" style={{ color: "var(--text-muted)" }}>{t.projects.empty}</p>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          {projects.map((p, i) => {
            const st = PROJECT_STATUS_LABEL[p.status] || PROJECT_STATUS_LABEL.active;
            return (
              <div key={p.id} onClick={() => setSelectedProjectId(p.id)} className="flex items-center justify-between px-4 py-3 flex-wrap gap-2 cursor-pointer transition-colors hover:bg-white/[0.02]" style={{ background: "var(--surface-1)", borderTop: i > 0 ? "1px solid var(--border)" : undefined }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{p.name} {p.contact ? `— ${p.contact.name}` : ""}</p>
                  {p.description && <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{p.description}</p>}
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <select value={p.status} onChange={(e) => setStatus(p.id, e.target.value)}
                    className="text-[10px] px-2 py-1 rounded-full font-medium outline-none" style={{ background: "var(--surface-2)", color: st.color, border: "none" }}>
                    {Object.entries(t.projectStatus).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                  </select>
                  <button onClick={() => deleteProject(p.id)}><Trash2 className="w-4 h-4" style={{ color: "#ef4444" }} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedProjectId && (
        <ProjectDetailModal
          key={selectedProjectId}
          isFa={isFa}
          lang={lang}
          t={t}
          project={projects.find((p) => p.id === selectedProjectId) || null}
          onClose={() => setSelectedProjectId(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}

const PROPERTY_LISTING_TYPE_LABEL: Record<string, Record<Lang, string>> = {
  buy: { fa: "خرید", en: "Buy", de: "Kauf" },
  sell: { fa: "فروش", en: "Sell", de: "Verkauf" },
  rent: { fa: "اجاره", en: "Rent", de: "Miete" },
  short_term_rent: { fa: "اجاره روزانه", en: "Short-term rental", de: "Kurzzeitmiete" },
};
const PROPERTY_TYPE_LABEL: Record<string, Record<Lang, string>> = {
  apartment: { fa: "آپارتمان", en: "Apartment", de: "Wohnung" },
  villa: { fa: "ویلا", en: "Villa", de: "Villa" },
  land: { fa: "زمین", en: "Land", de: "Grundstück" },
  commercial: { fa: "تجاری", en: "Commercial", de: "Gewerbe" },
};
const PROPERTY_STATUS_LABEL: Record<string, Record<Lang, string>> = {
  available: { fa: "موجود", en: "Available", de: "Verfügbar" },
  pending: { fa: "در حال معامله", en: "Pending", de: "Ausstehend" },
  sold: { fa: "فروخته‌شده", en: "Sold", de: "Verkauft" },
  rented: { fa: "اجاره‌داده‌شده", en: "Rented", de: "Vermietet" },
};
// IRT/IRR only make sense in Persian; USD/GBP/EUR are offered regardless of
// UI language (an agency may list a property in whatever currency the
// listing itself was priced in) — but the *default* choice when creating a
// property follows the current UI language (fa->IRT, de->EUR, else USD).
const CURRENCY_OPTIONS: { value: string; fa?: true; symbol: string; label: Record<Lang, string> }[] = [
  { value: "IRT", fa: true, symbol: "تومان", label: { fa: "تومان (IRT)", en: "Toman (IRT)", de: "Toman (IRT)" } },
  { value: "IRR", fa: true, symbol: "ریال", label: { fa: "ریال (IRR)", en: "Rial (IRR)", de: "Rial (IRR)" } },
  { value: "USD", symbol: "$", label: { fa: "دلار (USD)", en: "US Dollar (USD)", de: "US-Dollar (USD)" } },
  { value: "GBP", symbol: "£", label: { fa: "پوند (GBP)", en: "British Pound (GBP)", de: "Britisches Pfund (GBP)" } },
  { value: "EUR", symbol: "€", label: { fa: "یورو (EUR)", en: "Euro (EUR)", de: "Euro (EUR)" } },
  { value: "TRY", symbol: "₺", label: { fa: "لیر ترکیه (TRY)", en: "Turkish Lira (TRY)", de: "Türkische Lira (TRY)" } },
];
function defaultCurrencyForLang(lang: Lang): string {
  return lang === "fa" ? "IRT" : lang === "de" ? "EUR" : "USD";
}
function fmtPrice(n: number, currency: string, lang: Lang): string {
  const opt = CURRENCY_OPTIONS.find((c) => c.value === currency);
  const formatted = new Intl.NumberFormat(lang === "fa" ? "fa-IR" : "en-US").format(n);
  if (!opt) return formatted;
  return opt.fa ? `${formatted} ${opt.symbol}` : `${opt.symbol}${formatted}`;
}

/** Real-estate industry-pack module — Property/Listing Management. Only rendered when isModuleEnabled("crm.property") returned true (checked once in the parent via /api/crm/module-access). Reuses the unified Property model — same one Voice Agent and CRM Projects already write to — never a parallel table. */
interface GeoCountry { id: string; iso2: string; name: string; nameFa: string | null; nameDe: string | null; emoji: string | null; }
interface GeoCity { id: string; name: string; nameFa: string | null; nameDe: string | null; }

// Module-level cache, keyed by lang (server sorts by the localized name) —
// the country list (251 rows) never changes during a session, so every
// CountryCityPicker instance on a page shares one fetch per language
// instead of each form issuing its own.
const countriesCache: Partial<Record<Lang, Promise<GeoCountry[]>>> = {};
function loadCountries(lang: Lang): Promise<GeoCountry[]> {
  if (!countriesCache[lang]) {
    countriesCache[lang] = fetch(`/api/geo/countries?lang=${lang}`).then((r) => r.json()).then((d) => d.countries || []);
  }
  return countriesCache[lang]!;
}

/** Country → City cascading picker, backed by the seeded Country/City reference tables (prisma/seed-data/countries-cities.json, ~251 countries / ~141k cities, including Northern Cyprus). Only ever writes the plain city name into onCityChange — Property.city stays a string, this is purely an input-quality improvement over free text. */
let geoPickerSeq = 0;
function CountryCityPicker({ lang, cityValue, onCityChange }: { lang: Lang; cityValue: string; onCityChange: (city: string) => void }) {
  const [instanceId] = useState(() => ++geoPickerSeq);
  const [countries, setCountries] = useState<GeoCountry[]>([]);
  const [countryId, setCountryId] = useState("");
  const [countryQuery, setCountryQuery] = useState("");
  const [cities, setCities] = useState<GeoCity[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);

  useEffect(() => { loadCountries(lang).then(setCountries); }, [lang]);

  useEffect(() => {
    if (!countryId) { setCities([]); return; }
    setLoadingCities(true);
    fetch(`/api/geo/cities?countryId=${countryId}`).then((r) => r.json()).then((d) => setCities(d.cities || [])).finally(() => setLoadingCities(false));
  }, [countryId]);

  function countryLabel(c: GeoCountry) {
    const name = lang === "fa" ? (c.nameFa || c.name) : lang === "de" ? (c.nameDe || c.name) : c.name;
    return `${c.emoji ? c.emoji + " " : ""}${name}`;
  }
  // Falls back to the English name when a city has no curated translation
  // (only ~100 major cities are translated, not all ~153k rows).
  function cityLabel(c: GeoCity) {
    return lang === "fa" ? (c.nameFa || c.name) : lang === "de" ? (c.nameDe || c.name) : c.name;
  }

  const countryListId = `geo-countries-${instanceId}`;
  const cityListId = `geo-cities-${instanceId}`;

  return (
    <div className="grid grid-cols-2 gap-2">
      <div>
        <input
          list={countryListId}
          value={countryQuery}
          placeholder={tri(lang, "جستجوی کشور...", "Search country...", "Land suchen...")}
          onChange={(e) => {
            const val = e.target.value;
            setCountryQuery(val);
            const match = countries.find((c) => countryLabel(c) === val);
            if (match) { setCountryId(match.id); onCityChange(""); }
            else if (countryId) { setCountryId(""); onCityChange(""); }
          }}
          className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
        />
        <datalist id={countryListId}>
          {countries.map((c) => <option key={c.id} value={countryLabel(c)} />)}
        </datalist>
      </div>
      <div>
        <input
          list={cityListId}
          value={cityValue}
          disabled={!countryId}
          placeholder={!countryId ? tri(lang, "ابتدا کشور را انتخاب کنید", "Select a country first", "Zuerst Land wählen") : loadingCities ? tri(lang, "در حال بارگذاری...", "Loading...", "Wird geladen...") : tri(lang, "جستجوی شهر...", "Search city...", "Stadt suchen...")}
          onChange={(e) => onCityChange(e.target.value)}
          className="w-full px-3 py-2 rounded-xl text-sm outline-none disabled:opacity-50" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
        />
        <datalist id={cityListId}>
          {cities.map((c) => <option key={c.id} value={cityLabel(c)} />)}
        </datalist>
      </div>
    </div>
  );
}

function PropertiesPanel({ isFa, lang, contacts, shortTermCalendarEnabled, propertyDocumentsEnabled, listingCopywriterEnabled, pricingAdvisorEnabled }: { isFa: boolean; lang: Lang; contacts: Contact[]; shortTermCalendarEnabled: boolean; propertyDocumentsEnabled: boolean; listingCopywriterEnabled: boolean; pricingAdvisorEnabled: boolean }) {
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<PropertyRow | null>(null);
  const [calendarPropertyId, setCalendarPropertyId] = useState<string | null>(null);
  const [docsPropertyId, setDocsPropertyId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [listingType, setListingType] = useState("sell");
  const [propertyType, setPropertyType] = useState("apartment");
  const [price, setPrice] = useState("");
  const [nightlyPrice, setNightlyPrice] = useState("");
  const [currency, setCurrency] = useState(defaultCurrencyForLang(lang));
  const [bookingLink, setBookingLink] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [bathrooms, setBathrooms] = useState("");
  const [areaSqm, setAreaSqm] = useState("");
  const [description, setDescription] = useState("");
  const [ownerContactId, setOwnerContactId] = useState("");

  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ createdCount: number; totalRows: number; errors: { row: number; error: string }[] } | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/crm/properties");
    const data = await res.json();
    setProperties(data.properties || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/crm/properties/import", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setImportResult(data);
      load();
    } catch (err: unknown) {
      setImportResult({ createdCount: 0, totalRows: 0, errors: [{ row: 0, error: err instanceof Error ? err.message : tri(lang, "خطا در وارد کردن فایل", "Failed to import file", "Fehler beim Importieren der Datei") }] });
    } finally {
      setImporting(false);
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }

  function resetForm() {
    setTitle(""); setListingType("sell"); setPropertyType("apartment"); setPrice(""); setNightlyPrice("");
    setCurrency(defaultCurrencyForLang(lang));
    setBookingLink(""); setAddress(""); setCity(""); setBedrooms(""); setBathrooms(""); setAreaSqm(""); setDescription(""); setOwnerContactId("");
  }

  async function createProperty() {
    if (!title.trim()) { setError(tri(lang, "عنوان ملک الزامی است", "Property title is required", "Immobilientitel ist erforderlich")); return; }
    if (!address.trim()) { setError(tri(lang, "آدرس الزامی است", "Address is required", "Adresse ist erforderlich")); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/crm/properties", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(), listingType, propertyType, address: address.trim(), city: city.trim() || undefined,
          price: listingType !== "short_term_rent" ? price : undefined,
          nightlyPrice: listingType === "short_term_rent" ? nightlyPrice : undefined,
          currency,
          bookingLink: bookingLink.trim() || undefined,
          bedrooms: bedrooms || undefined, bathrooms: bathrooms || undefined, areaSqm: areaSqm || undefined,
          description: description.trim() || undefined,
          crmContactId: ownerContactId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.bookingLinkWarning) alert(data.bookingLinkWarning);
      setShowNew(false);
      resetForm();
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : tri(lang, "خطا در ذخیره ملک", "Failed to save property", "Fehler beim Speichern der Immobilie"));
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(id: string, status: string) {
    await fetch(`/api/crm/properties/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    load();
  }

  async function deleteProperty(id: string) {
    await fetch(`/api/crm/properties/${id}`, { method: "DELETE" });
    setSelected(null);
    load();
  }

  if (loading) return <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--primary)" }} />;

  return (
    <div className="space-y-3">
      <div className="flex justify-end items-center gap-2 flex-wrap">
        <a href="/api/crm/properties/import/template" download
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium" style={{ background: "var(--surface-2)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
          <FileDown className="w-3.5 h-3.5" /> {tri(lang, "دانلود نمونه اکسل", "Download sample template", "Beispielvorlage herunterladen")}
        </a>
        <button onClick={() => importInputRef.current?.click()} disabled={importing}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium disabled:opacity-50" style={{ background: "var(--surface-2)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
          {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          {tri(lang, "وارد کردن از فایل", "Import from file", "Aus Datei importieren")}
        </button>
        <input ref={importInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleImportFile} />
        <button onClick={() => setShowNew((v) => !v)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: "var(--primary)" }}>
          <Plus className="w-4 h-4" /> {tri(lang, "ملک جدید", "New property", "Neue Immobilie")}
        </button>
      </div>

      {importResult && (
        <div className="rounded-2xl p-4 space-y-2 text-sm" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between">
            <p style={{ color: importResult.createdCount > 0 ? "#22c55e" : "var(--text-primary)" }}>
              {tri(lang,
                `${importResult.createdCount} از ${importResult.totalRows} ردیف با موفقیت وارد شد`,
                `${importResult.createdCount} of ${importResult.totalRows} rows imported successfully`,
                `${importResult.createdCount} von ${importResult.totalRows} Zeilen erfolgreich importiert`)}
            </p>
            <button onClick={() => setImportResult(null)} style={{ color: "var(--text-muted)" }}><X className="w-4 h-4" /></button>
          </div>
          {importResult.errors.length > 0 && (
            <ul className="text-xs space-y-1" style={{ color: "#ef4444" }}>
              {importResult.errors.slice(0, 20).map((e, i) => (
                <li key={i}>{e.row > 0 ? tri(lang, `ردیف ${e.row}: `, `Row ${e.row}: `, `Zeile ${e.row}: `) : ""}{e.error}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {showNew && (
        <div className="rounded-2xl p-4 space-y-2" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tri(lang, "عنوان ملک", "Property title", "Immobilientitel")}
            className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <div className="grid grid-cols-2 gap-2">
            <select value={listingType} onChange={(e) => setListingType(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
              {Object.entries(PROPERTY_LISTING_TYPE_LABEL).map(([val, l]) => <option key={val} value={val}>{l[lang]}</option>)}
            </select>
            <select value={propertyType} onChange={(e) => setPropertyType(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
              {Object.entries(PROPERTY_TYPE_LABEL).map(([val, l]) => <option key={val} value={val}>{l[lang]}</option>)}
            </select>
          </div>
          <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder={tri(lang, "آدرس", "Address", "Adresse")}
            className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <CountryCityPicker lang={lang} cityValue={city} onCityChange={setCity} />

          {listingType === "short_term_rent" ? (
            <div className="grid grid-cols-2 gap-2">
              <input value={nightlyPrice} onChange={(e) => setNightlyPrice(e.target.value)} type="number" placeholder={tri(lang, "قیمت هر شب", "Price per night", "Preis pro Nacht")}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
              <select value={currency} onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                {CURRENCY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label[lang]}</option>)}
              </select>
              <input value={bookingLink} onChange={(e) => setBookingLink(e.target.value)} placeholder={tri(lang, "لینک Airbnb یا پلتفرم رزرو", "Airbnb or booking platform link", "Airbnb- oder Buchungsplattform-Link")}
                className="col-span-2 w-full px-3 py-2 rounded-xl text-sm outline-none" dir="ltr" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <input value={price} onChange={(e) => setPrice(e.target.value)} type="number" placeholder={tri(lang, "قیمت کل", "Total price", "Gesamtpreis")}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
              <select value={currency} onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                {CURRENCY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label[lang]}</option>)}
              </select>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <input value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} type="number" placeholder={tri(lang, "خواب", "Bedrooms", "Schlafzimmer")}
              className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            <input value={bathrooms} onChange={(e) => setBathrooms(e.target.value)} type="number" placeholder={tri(lang, "سرویس", "Bathrooms", "Badezimmer")}
              className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            <input value={areaSqm} onChange={(e) => setAreaSqm(e.target.value)} type="number" placeholder={tri(lang, "متراژ", "Area (sqm)", "Fläche (qm)")}
              className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          </div>

          <select value={ownerContactId} onChange={(e) => setOwnerContactId(e.target.value)}
            className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
            <option value="">{tri(lang, "بدون مالک/مخاطب مشخص", "No owner/contact set", "Kein Eigentümer/Kontakt festgelegt")}</option>
            {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder={tri(lang, "توضیحات", "Description", "Beschreibung")}
            className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />

          {error && <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>}
          <button onClick={createProperty} disabled={saving} className="w-full py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--primary)" }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : tri(lang, "ذخیره ملک", "Save property", "Immobilie speichern")}
          </button>
        </div>
      )}

      {properties.length === 0 ? (
        <p className="text-sm text-center py-12" style={{ color: "var(--text-muted)" }}>{tri(lang, "هنوز ملکی ثبت نشده است", "No properties yet", "Noch keine Immobilien")}</p>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          {properties.map((p, i) => (
            <div key={p.id} onClick={() => setSelected(p)} className="flex items-center justify-between px-4 py-3 flex-wrap gap-2 cursor-pointer transition-colors hover:bg-white/[0.02]" style={{ background: "var(--surface-1)", borderTop: i > 0 ? "1px solid var(--border)" : undefined }}>
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  {p.title} — {PROPERTY_LISTING_TYPE_LABEL[p.listingType]?.[lang] || p.listingType}
                  {p.crmContact ? ` · ${p.crmContact.name}` : ""}
                </p>
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  {p.address}{p.city ? `، ${p.city}` : ""} · {p.listingType === "short_term_rent" ? (p.nightlyPrice ? `${fmtPrice(p.nightlyPrice, p.currency, lang)} ${tri(lang, "شب", "/night", "/Nacht")}` : "—") : fmtPrice(p.price, p.currency, lang)}
                </p>
              </div>
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <select value={p.status} onChange={(e) => setStatus(p.id, e.target.value)}
                  className="text-[10px] px-2 py-1 rounded-full font-medium outline-none" style={{ background: "var(--surface-2)", color: "var(--text-secondary)", border: "none" }}>
                  {Object.entries(PROPERTY_STATUS_LABEL).map(([val, l]) => <option key={val} value={val}>{l[lang]}</option>)}
                </select>
                {p.listingType === "short_term_rent" && shortTermCalendarEnabled && (
                  <button onClick={() => setCalendarPropertyId(p.id)} title={tri(lang, "تقویم اشغال", "Occupancy calendar", "Belegungskalender")}>
                    <CalendarDays className="w-4 h-4" style={{ color: "var(--primary)" }} />
                  </button>
                )}
                {propertyDocumentsEnabled && (
                  <button onClick={() => setDocsPropertyId(p.id)} title={tri(lang, "اسناد ملک", "Property documents", "Immobiliendokumente")}>
                    <FileText className="w-4 h-4" style={{ color: "var(--primary)" }} />
                  </button>
                )}
                <button onClick={() => deleteProperty(p.id)}><Trash2 className="w-4 h-4" style={{ color: "#ef4444" }} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {calendarPropertyId && (
        <OccupancyCalendarModal lang={lang} propertyId={calendarPropertyId} contacts={contacts} onClose={() => setCalendarPropertyId(null)} />
      )}
      {docsPropertyId && (
        <PropertyDocsModal lang={lang} propertyId={docsPropertyId} onClose={() => setDocsPropertyId(null)} />
      )}
      {selected && (
        <PropertyDetailModal lang={lang} property={selected} contacts={contacts} listingCopywriterEnabled={listingCopywriterEnabled} pricingAdvisorEnabled={pricingAdvisorEnabled}
          onClose={() => setSelected(null)}
          onChanged={() => { load(); }}
        />
      )}
    </div>
  );
}

/** Section 1, item 6 — Short-term rental occupancy calendar. Mandatory (not an optional add-on) for any property with listingType "short_term_rent" — the calendar icon always appears on that row's property whenever crm.shortTermCalendar is enabled, never behind a further per-property opt-in. Surfaces Property.bookingLink alongside the in-app calendar since (per researched Airbnb/Booking.com API limits) no live two-way sync exists — bookingLink stays a manual cross-check, not an automated source. */
function OccupancyCalendarModal({ lang, propertyId, contacts, onClose }: { lang: Lang; propertyId: string; contacts: Contact[]; onClose: () => void }) {
  const [bookings, setBookings] = useState<{ id: string; checkIn: string; checkOut: string; guestName: string | null; status: string; contact: { id: string; name: string } | null }[]>([]);
  const [bookingLink, setBookingLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guestName, setGuestName] = useState("");
  const [contactId, setContactId] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/crm/properties/${propertyId}/bookings`);
    const data = await res.json();
    setBookings(data.bookings || []);
    setBookingLink(data.bookingLink || null);
    setLoading(false);
  }, [propertyId]);

  useEffect(() => { load(); }, [load]);

  async function addBooking() {
    if (!checkIn || !checkOut) { setError(tri(lang, "تاریخ ورود و خروج الزامی است", "Check-in and check-out are required", "An- und Abreise erforderlich")); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/crm/properties/${propertyId}/bookings`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkIn, checkOut, guestName: guestName.trim() || undefined, contactId: contactId || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCheckIn(""); setCheckOut(""); setGuestName(""); setContactId("");
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : tri(lang, "خطا در ثبت رزرو", "Failed to save booking", "Fehler beim Speichern der Buchung"));
    } finally {
      setSaving(false);
    }
  }

  async function cancelBooking(id: string) {
    await fetch(`/api/crm/bookings/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "cancelled" }) });
    load();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
      <div className="w-full max-w-lg rounded-2xl p-5 space-y-3 max-h-[85vh] overflow-y-auto" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{tri(lang, "تقویم اشغال", "Occupancy calendar", "Belegungskalender")}</h3>
          <button onClick={onClose}><X className="w-5 h-5" style={{ color: "var(--text-muted)" }} /></button>
        </div>

        {bookingLink && (
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            {tri(lang, "لینک پلتفرم رزرو (بررسی دستی — سینک آنی خودکار موجود نیست): ", "Booking platform link (manual check — no instant auto-sync available): ", "Buchungsplattform-Link (manuelle Prüfung — keine sofortige Auto-Synchronisierung): ")}
            <a href={bookingLink} target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)" }}>{bookingLink}</a>
          </p>
        )}

        <div className="rounded-xl p-3 space-y-2" style={{ background: "var(--surface-2)" }}>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] mb-1" style={{ color: "var(--text-muted)" }}>{tri(lang, "ورود", "Check-in", "Anreise")}</label>
              <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg text-xs outline-none" style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            </div>
            <div>
              <label className="block text-[10px] mb-1" style={{ color: "var(--text-muted)" }}>{tri(lang, "خروج", "Check-out", "Abreise")}</label>
              <input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg text-xs outline-none" style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            </div>
          </div>
          <input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder={tri(lang, "نام مهمان (اختیاری)", "Guest name (optional)", "Gastname (optional)")}
            className="w-full px-2 py-1.5 rounded-lg text-xs outline-none" style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <select value={contactId} onChange={(e) => setContactId(e.target.value)}
            className="w-full px-2 py-1.5 rounded-lg text-xs outline-none" style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
            <option value="">{tri(lang, "بدون لینک به مخاطب", "No linked contact", "Kein verknüpfter Kontakt")}</option>
            {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {error && <p className="text-[11px]" style={{ color: "#ef4444" }}>{error}</p>}
          <button onClick={addBooking} disabled={saving} className="w-full py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50" style={{ background: "var(--primary)" }}>
            {saving ? "..." : tri(lang, "ثبت رزرو", "Add booking", "Buchung hinzufügen")}
          </button>
        </div>

        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin mx-auto" style={{ color: "var(--primary)" }} />
        ) : bookings.filter((b) => b.status === "confirmed").length === 0 ? (
          <p className="text-xs text-center py-4" style={{ color: "var(--text-muted)" }}>{tri(lang, "هنوز رزروی ثبت نشده است", "No bookings yet", "Noch keine Buchungen")}</p>
        ) : (
          <div className="space-y-1.5">
            {bookings.filter((b) => b.status === "confirmed").map((b) => (
              <div key={b.id} className="flex items-center justify-between px-3 py-2 rounded-lg text-xs" style={{ background: "var(--surface-2)" }}>
                <span style={{ color: "var(--text-primary)" }}>
                  {b.checkIn.slice(0, 10)} → {b.checkOut.slice(0, 10)}{b.guestName ? ` · ${b.guestName}` : b.contact ? ` · ${b.contact.name}` : ""}
                </span>
                <button onClick={() => cancelBooking(b.id)} className="text-[11px]" style={{ color: "#ef4444" }}>
                  {tri(lang, "لغو", "Cancel", "Stornieren")}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const DOC_TYPE_LABEL: Record<string, Record<Lang, string>> = {
  title_deed: { fa: "سند مالکیت", en: "Title deed", de: "Eigentumsurkunde" },
  power_of_attorney: { fa: "وکالت‌نامه", en: "Power of attorney", de: "Vollmacht" },
  floor_plan: { fa: "نقشه پلان", en: "Floor plan", de: "Grundriss" },
  photo: { fa: "عکس", en: "Photo", de: "Foto" },
  attachment: { fa: "سایر", en: "Other", de: "Sonstiges" },
};

/** Section 1, item 7 — Property document archive. Reuses the existing CrmDocument model/upload route (adds propertyId) — not a parallel table. Files are only ever fetched through /api/crm/documents/[id]/download, which mints a short-lived signed URL per authenticated request instead of exposing the long-lived link stored in the DB. */
function PropertyDocsModal({ lang, propertyId, onClose }: { lang: Lang; propertyId: string; onClose: () => void }) {
  const [documents, setDocuments] = useState<{ id: string; name: string; type: string; createdAt: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState("title_deed");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/crm/documents?propertyId=${propertyId}`);
    const data = await res.json();
    setDocuments(data.documents || []);
    setLoading(false);
  }, [propertyId]);

  useEffect(() => { load(); }, [load]);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("propertyId", propertyId);
      form.append("type", docType);
      form.append("name", file.name);
      const res = await fetch("/api/crm/documents", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : tri(lang, "خطا در آپلود فایل", "Upload failed", "Upload fehlgeschlagen"));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function removeDoc(id: string) {
    await fetch("/api/crm/documents", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    load();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
      <div className="w-full max-w-lg rounded-2xl p-5 space-y-3 max-h-[85vh] overflow-y-auto" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{tri(lang, "اسناد ملک", "Property documents", "Immobiliendokumente")}</h3>
          <button onClick={onClose}><X className="w-5 h-5" style={{ color: "var(--text-muted)" }} /></button>
        </div>

        <div className="rounded-xl p-3 space-y-2" style={{ background: "var(--surface-2)" }}>
          <select value={docType} onChange={(e) => setDocType(e.target.value)}
            className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
            {Object.entries(DOC_TYPE_LABEL).map(([val, l]) => <option key={val} value={val}>{l[lang]}</option>)}
          </select>
          <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx" onChange={handleFileSelect} disabled={uploading}
            className="w-full text-xs" style={{ color: "var(--text-secondary)" }} />
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{tri(lang, "PDF، تصویر، Word یا Excel — حداکثر ۱۵ مگابایت", "PDF, image, Word, or Excel — max 15MB", "PDF, Bild, Word oder Excel — max. 15MB")}</p>
          {uploading && <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--primary)" }} />}
          {error && <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>}
        </div>

        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin mx-auto" style={{ color: "var(--primary)" }} />
        ) : documents.length === 0 ? (
          <p className="text-xs text-center py-4" style={{ color: "var(--text-muted)" }}>{tri(lang, "هنوز سندی آپلود نشده است", "No documents uploaded yet", "Noch keine Dokumente hochgeladen")}</p>
        ) : (
          <div className="space-y-1.5">
            {documents.map((d) => (
              <div key={d.id} className="flex items-center justify-between px-3 py-2 rounded-xl text-xs" style={{ background: "var(--surface-2)" }}>
                <a href={`/api/crm/documents/${d.id}/download`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                  <FileText className="w-3.5 h-3.5" style={{ color: "var(--primary)" }} />
                  {d.name} <span style={{ color: "var(--text-muted)" }}>— {DOC_TYPE_LABEL[d.type]?.[lang] || d.type}</span>
                </a>
                <button onClick={() => removeDoc(d.id)}><Trash2 className="w-3.5 h-3.5" style={{ color: "#ef4444" }} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** "View more" property detail — clicking a property row used to just set state with no modal ever rendering it (a real bug). Also covers: photo upload/gallery, editable currency, editable booking (Airbnb) link post-creation, and converting/creating an owner contact inline instead of only picking an existing one. */
function PropertyDetailModal({ lang, property, contacts, listingCopywriterEnabled, pricingAdvisorEnabled, onClose, onChanged }: { lang: Lang; property: PropertyRow; contacts: Contact[]; listingCopywriterEnabled: boolean; pricingAdvisorEnabled: boolean; onClose: () => void; onChanged: () => void }) {
  const [pricingAdvice, setPricingAdvice] = useState<{ priceRangeLow: number; priceRangeHigh: number; reasoning: string; dataLimitation: string; comparablesUsed: number } | null>(null);
  const [generatingAdvice, setGeneratingAdvice] = useState(false);
  const [adviceError, setAdviceError] = useState("");

  async function generatePricingAdviceClick() {
    setGeneratingAdvice(true);
    setAdviceError("");
    setPricingAdvice(null);
    try {
      const res = await fetch(`/api/crm/properties/${property.id}/pricing-advice`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPricingAdvice(data);
    } catch (err: unknown) {
      setAdviceError(err instanceof Error ? err.message : tri(lang, "خطا در تولید پیشنهاد قیمت", "Failed to generate pricing advice", "Fehler bei der Preisempfehlung"));
    } finally {
      setGeneratingAdvice(false);
    }
  }
  const [copyPlatform, setCopyPlatform] = useState<"instagram" | "divar" | "website">("instagram");
  const [copyResult, setCopyResult] = useState<{ content: string; hashtags?: string[] } | null>(null);
  const [generatingCopy, setGeneratingCopy] = useState(false);
  const [copyError, setCopyError] = useState("");
  const [copied, setCopied] = useState(false);

  async function generateCopy() {
    setGeneratingCopy(true);
    setCopyError("");
    setCopyResult(null);
    try {
      const res = await fetch(`/api/crm/properties/${property.id}/listing-copy?platform=${copyPlatform}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCopyResult(data);
    } catch (err: unknown) {
      setCopyError(err instanceof Error ? err.message : tri(lang, "خطا در تولید متن آگهی", "Failed to generate listing copy", "Fehler beim Erstellen des Anzeigentexts"));
    } finally {
      setGeneratingCopy(false);
    }
  }

  function copyToClipboard() {
    if (!copyResult) return;
    const full = copyResult.hashtags?.length ? `${copyResult.content}\n\n${copyResult.hashtags.join(" ")}` : copyResult.content;
    navigator.clipboard.writeText(full);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    title: property.title,
    price: property.listingType === "short_term_rent" ? "" : String(property.price),
    nightlyPrice: property.nightlyPrice != null ? String(property.nightlyPrice) : "",
    currency: property.currency,
    bookingLink: property.bookingLink || "",
    address: property.address,
    city: property.city || "",
    bedrooms: property.bedrooms != null ? String(property.bedrooms) : "",
    bathrooms: property.bathrooms != null ? String(property.bathrooms) : "",
    areaSqm: property.areaSqm != null ? String(property.areaSqm) : "",
    description: property.description || "",
  });
  const [ownerContactId, setOwnerContactId] = useState(property.crmContact?.id || "");
  const [showNewOwner, setShowNewOwner] = useState(false);
  const [newOwnerName, setNewOwnerName] = useState("");
  const [newOwnerPhone, setNewOwnerPhone] = useState("");
  const [savingOwner, setSavingOwner] = useState(false);

  const [images, setImages] = useState<string[]>(() => {
    try { return property.images ? JSON.parse(property.images) : []; } catch { return []; }
  });
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Interested customers — buyers/tenants who want THIS property, distinct
  // from the owner above (Property.crmContactId is the owner/seller link).
  const [interests, setInterests] = useState<{ contactId: string; note: string | null; contact: { id: string; name: string; phone: string | null; email: string | null } }[]>([]);
  const [loadingInterests, setLoadingInterests] = useState(true);
  const [showRegisterInterest, setShowRegisterInterest] = useState(false);
  const [interestContactId, setInterestContactId] = useState("");
  const [interestNewName, setInterestNewName] = useState("");
  const [interestNewPhone, setInterestNewPhone] = useState("");
  const [interestNote, setInterestNote] = useState("");
  const [savingInterest, setSavingInterest] = useState(false);

  useEffect(() => {
    fetch(`/api/crm/properties/${property.id}/interests`)
      .then((r) => r.json())
      .then((d) => setInterests(d.interests || []))
      .finally(() => setLoadingInterests(false));
  }, [property.id]);

  async function registerInterest() {
    setSavingInterest(true);
    setError("");
    try {
      const res = await fetch(`/api/crm/properties/${property.id}/interests`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          interestContactId
            ? { contactId: interestContactId, note: interestNote.trim() || undefined }
            : { name: interestNewName.trim(), phone: interestNewPhone.trim() || undefined, note: interestNote.trim() || undefined }
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setInterests((prev) => [data.interest, ...prev.filter((i) => i.contactId !== data.interest.contactId)]);
      setShowRegisterInterest(false);
      setInterestContactId(""); setInterestNewName(""); setInterestNewPhone(""); setInterestNote("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : tri(lang, "خطا در ثبت مشتری", "Failed to register customer", "Fehler beim Registrieren des Kunden"));
    } finally {
      setSavingInterest(false);
    }
  }

  async function removeInterest(contactId: string) {
    await fetch(`/api/crm/properties/${property.id}/interests`, {
      method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contactId }),
    });
    setInterests((prev) => prev.filter((i) => i.contactId !== contactId));
  }

  async function saveEdit() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/crm/properties/${property.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          price: property.listingType !== "short_term_rent" ? form.price : undefined,
          nightlyPrice: property.listingType === "short_term_rent" ? form.nightlyPrice : undefined,
          currency: form.currency,
          bookingLink: form.bookingLink.trim() || null,
          address: form.address.trim(),
          city: form.city.trim() || null,
          bedrooms: form.bedrooms || null,
          bathrooms: form.bathrooms || null,
          areaSqm: form.areaSqm || null,
          description: form.description.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.bookingLinkWarning) alert(data.bookingLinkWarning);
      setEditing(false);
      onChanged();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : tri(lang, "خطا در ذخیره", "Failed to save", "Fehler beim Speichern"));
    } finally {
      setSaving(false);
    }
  }

  async function changeOwner(contactId: string) {
    setOwnerContactId(contactId);
    await fetch(`/api/crm/properties/${property.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ crmContactId: contactId || null }),
    });
    onChanged();
  }

  async function createOwnerAndAssign() {
    if (!newOwnerName.trim()) return;
    setSavingOwner(true);
    try {
      const res = await fetch("/api/crm/contacts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newOwnerName.trim(), phone: newOwnerPhone.trim() || undefined, status: "customer" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await changeOwner(data.contact.id);
      setShowNewOwner(false);
      setNewOwnerName(""); setNewOwnerPhone("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : tri(lang, "خطا در ایجاد مالک", "Failed to create owner", "Fehler beim Anlegen des Eigentümers"));
    } finally {
      setSavingOwner(false);
    }
  }

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const form2 = new FormData();
      form2.append("file", file);
      const res = await fetch(`/api/crm/properties/${property.id}/images`, { method: "POST", body: form2 });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setImages(data.images || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : tri(lang, "خطا در آپلود عکس", "Failed to upload photo", "Fehler beim Hochladen des Fotos"));
    } finally {
      setUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  }

  async function removeImage(url: string) {
    const res = await fetch(`/api/crm/properties/${property.id}/images`, {
      method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }),
    });
    const data = await res.json();
    if (res.ok) setImages(data.images || []);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl p-5 space-y-4 max-h-[88vh] overflow-y-auto" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>{property.title}</h3>
          <div className="flex items-center gap-2">
            <button onClick={() => setEditing((v) => !v)} className="text-xs px-3 py-1.5 rounded-lg" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
              {editing ? tri(lang, "انصراف", "Cancel", "Abbrechen") : tri(lang, "ویرایش", "Edit", "Bearbeiten")}
            </button>
            <button onClick={onClose}><X className="w-5 h-5" style={{ color: "var(--text-muted)" }} /></button>
          </div>
        </div>

        {/* Photo gallery */}
        <div>
          <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-primary)" }}>{tri(lang, "تصاویر ملک", "Property photos", "Immobilienfotos")}</p>
          <div className="flex flex-wrap gap-2 mb-2">
            {images.map((url) => (
              <div key={url} className="relative w-20 h-20 rounded-xl overflow-hidden group" style={{ background: "var(--surface-2)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="w-full h-full object-cover" />
                <button onClick={() => removeImage(url)} className="absolute top-1 left-1 w-5 h-5 rounded-full flex items-center justify-center text-xs" style={{ background: "rgba(0,0,0,0.6)", color: "#fff" }}>×</button>
              </div>
            ))}
            <label className="w-20 h-20 rounded-xl flex items-center justify-center cursor-pointer" style={{ background: "var(--surface-2)", border: "1px dashed var(--border)" }}>
              {uploadingImage ? <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--primary)" }} /> : <Upload className="w-4 h-4" style={{ color: "var(--text-muted)" }} />}
              <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageSelect} disabled={uploadingImage} className="hidden" />
            </label>
          </div>
          <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{tri(lang, "JPEG، PNG یا WebP — حداکثر ۸ مگابایت", "JPEG, PNG, or WebP — max 8MB", "JPEG, PNG oder WebP — max. 8MB")}</p>
        </div>

        {error && <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>}

        {editing ? (
          <div className="space-y-2">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={tri(lang, "عنوان", "Title", "Titel")}
              className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            <div className="grid grid-cols-2 gap-2">
              {property.listingType === "short_term_rent" ? (
                <input value={form.nightlyPrice} onChange={(e) => setForm({ ...form, nightlyPrice: e.target.value })} type="number" placeholder={tri(lang, "قیمت هر شب", "Price per night", "Preis pro Nacht")}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
              ) : (
                <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} type="number" placeholder={tri(lang, "قیمت کل", "Total price", "Gesamtpreis")}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
              )}
              <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                {CURRENCY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label[lang]}</option>)}
              </select>
            </div>
            {property.listingType === "short_term_rent" && (
              <input value={form.bookingLink} onChange={(e) => setForm({ ...form, bookingLink: e.target.value })} placeholder={tri(lang, "لینک Airbnb یا پلتفرم رزرو", "Airbnb or booking platform link", "Airbnb- oder Buchungsplattform-Link")} dir="ltr"
                className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            )}
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder={tri(lang, "آدرس", "Address", "Adresse")}
              className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            <CountryCityPicker lang={lang} cityValue={form.city} onCityChange={(city) => setForm({ ...form, city })} />
            <div className="grid grid-cols-3 gap-2">
              <input value={form.bedrooms} onChange={(e) => setForm({ ...form, bedrooms: e.target.value })} type="number" placeholder={tri(lang, "خواب", "Bedrooms", "Schlafzimmer")}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
              <input value={form.bathrooms} onChange={(e) => setForm({ ...form, bathrooms: e.target.value })} type="number" placeholder={tri(lang, "سرویس", "Bathrooms", "Badezimmer")}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
              <input value={form.areaSqm} onChange={(e) => setForm({ ...form, areaSqm: e.target.value })} type="number" placeholder={tri(lang, "متراژ", "Area (sqm)", "Fläche (qm)")}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            </div>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder={tri(lang, "توضیحات", "Description", "Beschreibung")}
              className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            <button onClick={saveEdit} disabled={saving} className="w-full py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--primary)" }}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : tri(lang, "ذخیره تغییرات", "Save changes", "Änderungen speichern")}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span style={{ color: "var(--text-muted)" }}>{tri(lang, "نوع معامله: ", "Deal type: ", "Geschäftsart: ")}</span><span style={{ color: "var(--text-primary)" }}>{PROPERTY_LISTING_TYPE_LABEL[property.listingType]?.[lang] || property.listingType}</span></div>
            <div><span style={{ color: "var(--text-muted)" }}>{tri(lang, "نوع ملک: ", "Property type: ", "Immobilientyp: ")}</span><span style={{ color: "var(--text-primary)" }}>{PROPERTY_TYPE_LABEL[property.propertyType]?.[lang] || property.propertyType}</span></div>
            <div className="col-span-2"><span style={{ color: "var(--text-muted)" }}>{tri(lang, "قیمت: ", "Price: ", "Preis: ")}</span><span style={{ color: "var(--text-primary)" }}>{property.listingType === "short_term_rent" ? (property.nightlyPrice ? `${fmtPrice(property.nightlyPrice, property.currency, lang)} / ${tri(lang, "شب", "night", "Nacht")}` : "—") : fmtPrice(property.price, property.currency, lang)}</span></div>
            {property.listingType === "short_term_rent" && property.bookingLink && (
              <div className="col-span-2"><span style={{ color: "var(--text-muted)" }}>{tri(lang, "لینک رزرو: ", "Booking link: ", "Buchungslink: ")}</span><a href={property.bookingLink} target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)" }}>{property.bookingLink}</a></div>
            )}
            <div className="col-span-2"><span style={{ color: "var(--text-muted)" }}>{tri(lang, "آدرس: ", "Address: ", "Adresse: ")}</span><span style={{ color: "var(--text-primary)" }}>{property.address}{property.city ? `، ${property.city}` : ""}</span></div>
            {(property.bedrooms != null || property.bathrooms != null || property.areaSqm != null) && (
              <div className="col-span-2"><span style={{ color: "var(--text-muted)" }}>{tri(lang, "مشخصات: ", "Details: ", "Details: ")}</span><span style={{ color: "var(--text-primary)" }}>{[property.bedrooms != null ? tri(lang, `${property.bedrooms} خواب`, `${property.bedrooms} bed`, `${property.bedrooms} Schlafz.`) : null, property.bathrooms != null ? tri(lang, `${property.bathrooms} سرویس`, `${property.bathrooms} bath`, `${property.bathrooms} Bad`) : null, property.areaSqm != null ? tri(lang, `${property.areaSqm} متر`, `${property.areaSqm} sqm`, `${property.areaSqm} qm`) : null].filter(Boolean).join(" · ")}</span></div>
            )}
            {property.description && (
              <div className="col-span-2"><span style={{ color: "var(--text-muted)" }}>{tri(lang, "توضیحات: ", "Description: ", "Beschreibung: ")}</span><span style={{ color: "var(--text-primary)" }}>{property.description}</span></div>
            )}
          </div>
        )}

        {/* Owner section — pick existing, or create+assign a new one inline. */}
        <div className="pt-2 space-y-2" style={{ borderTop: "1px solid var(--border)" }}>
          <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{tri(lang, "مالک", "Owner", "Eigentümer")}</p>
          {!showNewOwner ? (
            <div className="flex items-center gap-2">
              <select value={ownerContactId} onChange={(e) => changeOwner(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                <option value="">{tri(lang, "بدون مالک", "No owner", "Kein Eigentümer")}</option>
                {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button onClick={() => setShowNewOwner(true)} className="text-xs px-3 py-2 rounded-xl whitespace-nowrap" style={{ background: "var(--surface-2)", color: "var(--primary)" }}>
                {tri(lang, "+ مالک جدید", "+ New owner", "+ Neuer Eigentümer")}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input value={newOwnerName} onChange={(e) => setNewOwnerName(e.target.value)} placeholder={tri(lang, "نام مالک", "Owner name", "Name des Eigentümers")}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                <input value={newOwnerPhone} onChange={(e) => setNewOwnerPhone(e.target.value)} placeholder={tri(lang, "شماره تماس (اختیاری)", "Phone (optional)", "Telefon (optional)")}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
              </div>
              <div className="flex gap-2">
                <button onClick={createOwnerAndAssign} disabled={savingOwner || !newOwnerName.trim()} className="flex-1 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-50" style={{ background: "var(--primary)" }}>
                  {savingOwner ? "..." : tri(lang, "ایجاد و انتساب مالک", "Create & assign owner", "Erstellen & zuweisen")}
                </button>
                <button onClick={() => setShowNewOwner(false)} className="flex-1 py-2 rounded-xl text-xs" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
                  {tri(lang, "لغو", "Cancel", "Abbrechen")}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Interested customers — buyers/tenants who want THIS property; distinct from the owner above. */}
        <div className="pt-2 space-y-2" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{tri(lang, "مشتریان علاقه‌مند به این ملک", "Customers interested in this property", "Interessierte Kunden")}</p>
            <button onClick={() => setShowRegisterInterest((v) => !v)} className="text-xs px-3 py-1.5 rounded-lg" style={{ background: "var(--surface-2)", color: "var(--primary)" }}>
              {tri(lang, "+ ثبت مشتری", "+ Register customer", "+ Kunde registrieren")}
            </button>
          </div>

          {showRegisterInterest && (
            <div className="rounded-xl p-3 space-y-2" style={{ background: "var(--surface-2)" }}>
              <select value={interestContactId} onChange={(e) => setInterestContactId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                <option value="">{tri(lang, "مشتری جدید (نام را زیر وارد کنید)", "New customer (enter name below)", "Neuer Kunde (Namen unten eingeben)")}</option>
                {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {!interestContactId && (
                <div className="grid grid-cols-2 gap-2">
                  <input value={interestNewName} onChange={(e) => setInterestNewName(e.target.value)} placeholder={tri(lang, "نام مشتری", "Customer name", "Kundenname")}
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                  <input value={interestNewPhone} onChange={(e) => setInterestNewPhone(e.target.value)} placeholder={tri(lang, "شماره تماس (اختیاری)", "Phone (optional)", "Telefon (optional)")}
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                </div>
              )}
              <input value={interestNote} onChange={(e) => setInterestNote(e.target.value)} placeholder={tri(lang, "یادداشت (اختیاری)", "Note (optional)", "Notiz (optional)")}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
              <div className="flex gap-2">
                <button onClick={registerInterest} disabled={savingInterest || (!interestContactId && !interestNewName.trim())} className="flex-1 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-50" style={{ background: "var(--primary)" }}>
                  {savingInterest ? "..." : tri(lang, "ثبت", "Register", "Registrieren")}
                </button>
                <button onClick={() => setShowRegisterInterest(false)} className="flex-1 py-2 rounded-xl text-xs" style={{ background: "var(--surface-1)", color: "var(--text-secondary)" }}>
                  {tri(lang, "لغو", "Cancel", "Abbrechen")}
                </button>
              </div>
            </div>
          )}

          {loadingInterests ? (
            <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--primary)" }} />
          ) : interests.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{tri(lang, "هنوز مشتری‌ای ثبت نشده است", "No customers registered yet", "Noch keine Kunden registriert")}</p>
          ) : (
            <div className="space-y-1.5">
              {interests.map((i) => (
                <div key={i.contactId} className="flex items-center justify-between px-3 py-2 rounded-xl text-xs" style={{ background: "var(--surface-2)" }}>
                  <div>
                    <span style={{ color: "var(--text-primary)" }}>{i.contact.name}</span>
                    {i.contact.phone && <span style={{ color: "var(--text-muted)" }}> · {i.contact.phone}</span>}
                    {i.note && <p style={{ color: "var(--text-muted)" }}>{i.note}</p>}
                  </div>
                  <button onClick={() => removeInterest(i.contactId)}><Trash2 className="w-3.5 h-3.5" style={{ color: "#ef4444" }} /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 2, item 2 — Listing Copywriter agent. AI only ever produces a draft here; the agent copies it to actually post/publish, nothing is auto-published. */}
        {listingCopywriterEnabled && (
          <div className="pt-2 space-y-2" style={{ borderTop: "1px solid var(--border)" }}>
            <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{tri(lang, "متن آگهی (چندپلتفرمی)", "Listing copy (multi-platform)", "Anzeigentext (mehrere Plattformen)")}</p>
            <div className="flex items-center gap-2">
              {(["instagram", "divar", "website"] as const).map((p) => (
                <button key={p} onClick={() => { setCopyPlatform(p); setCopyResult(null); }}
                  className="text-xs px-3 py-1.5 rounded-lg"
                  style={{ background: copyPlatform === p ? "var(--primary)" : "var(--surface-2)", color: copyPlatform === p ? "#fff" : "var(--text-secondary)" }}>
                  {p === "instagram" ? "Instagram" : p === "divar" ? "دیوار" : tri(lang, "وبسایت", "Website", "Website")}
                </button>
              ))}
              <button onClick={generateCopy} disabled={generatingCopy} className="text-xs px-3 py-1.5 rounded-lg text-white disabled:opacity-50 flex items-center gap-1.5" style={{ background: "var(--primary)" }}>
                {generatingCopy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {tri(lang, "تولید", "Generate", "Generieren")}
              </button>
            </div>
            {copyError && <p className="text-xs" style={{ color: "#ef4444" }}>{copyError}</p>}
            {copyResult && (
              <div className="rounded-xl p-3 space-y-2" style={{ background: "var(--surface-2)" }}>
                <p className="text-xs whitespace-pre-wrap" style={{ color: "var(--text-primary)" }}>{copyResult.content}</p>
                {copyResult.hashtags && copyResult.hashtags.length > 0 && (
                  <p className="text-xs" style={{ color: "var(--primary)" }} dir="ltr">{copyResult.hashtags.join(" ")}</p>
                )}
                <button onClick={copyToClipboard} className="text-xs px-3 py-1.5 rounded-lg" style={{ background: copied ? "#22c55e" : "var(--surface-1)", color: copied ? "#fff" : "var(--text-secondary)" }}>
                  {copied ? tri(lang, "کپی شد", "Copied", "Kopiert") : tri(lang, "کپی متن", "Copy text", "Text kopieren")}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Section 2, item 5 — Pricing Advisor. The most sensitive of the six agents (real money, owner trust): internal CRM data only, suggestion never a decision, reasoning always shown, and the "few comparables" limitation is surfaced honestly rather than hidden. */}
        {pricingAdvisorEnabled && (
          <div className="pt-2 space-y-2" style={{ borderTop: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{tri(lang, "مشاور قیمت‌گذاری", "Pricing Advisor", "Preisberater")}</p>
              <button onClick={generatePricingAdviceClick} disabled={generatingAdvice} className="text-xs px-3 py-1.5 rounded-lg text-white disabled:opacity-50 flex items-center gap-1.5" style={{ background: "var(--primary)" }}>
                {generatingAdvice ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {tri(lang, "تحلیل قیمت", "Analyze price", "Preis analysieren")}
              </button>
            </div>
            {adviceError && <p className="text-xs" style={{ color: "#ef4444" }}>{adviceError}</p>}
            {pricingAdvice && (
              <div className="rounded-xl p-3 space-y-2" style={{ background: "var(--surface-2)" }}>
                <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                  {tri(lang, "⚠️ فقط بر اساس داده‌های داخلی CRM — بدون دسترسی به بازار زنده یا خارجی. این یک پیشنهاد است، نه تصمیم قطعی.", "⚠️ Based only on internal CRM data — no live or external market access. This is a suggestion, not a final decision.", "⚠️ Nur basierend auf internen CRM-Daten — kein Zugriff auf Live- oder externe Marktdaten. Dies ist ein Vorschlag, keine endgültige Entscheidung.")}
                </p>
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  {fmtPrice(pricingAdvice.priceRangeLow, property.currency, lang)} – {fmtPrice(pricingAdvice.priceRangeHigh, property.currency, lang)}
                </p>
                <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{pricingAdvice.reasoning}</p>
                <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{tri(lang, `بر اساس ${pricingAdvice.comparablesUsed} ملک مشابه در سیستم شما.`, `Based on ${pricingAdvice.comparablesUsed} comparable properties in your system.`, `Basierend auf ${pricingAdvice.comparablesUsed} vergleichbaren Immobilien in Ihrem System.`)}</p>
                {pricingAdvice.dataLimitation && (
                  <p className="text-[10px]" style={{ color: "#f59e0b" }}>{pricingAdvice.dataLimitation}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Section 1, item 2 — Owner Management. "Owner" is derived, not a stored role: a CrmContact shows up here purely because it's linked via Property.crmContactId to >=1 property. Representation terms are edited per-property (same PATCH endpoint as PropertiesPanel), gated separately behind crm.owner. */
function OwnersPanel({ lang }: { lang: Lang }) {
  const [owners, setOwners] = useState<OwnerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ ownerId: string; propertyId: string } | null>(null);
  const [form, setForm] = useState({ representationStartDate: "", representationEndDate: "", agreedCommissionRate: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/crm/owners");
    const data = await res.json();
    setOwners(data.owners || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function startEdit(ownerId: string, prop: OwnerRow["properties"][number]) {
    setEditing({ ownerId, propertyId: prop.id });
    setForm({
      representationStartDate: prop.representationStartDate ? prop.representationStartDate.slice(0, 10) : "",
      representationEndDate: prop.representationEndDate ? prop.representationEndDate.slice(0, 10) : "",
      agreedCommissionRate: prop.agreedCommissionRate != null ? String(prop.agreedCommissionRate) : "",
    });
  }

  async function saveRepresentation() {
    if (!editing) return;
    setSaving(true);
    try {
      await fetch(`/api/crm/properties/${editing.propertyId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          representationStartDate: form.representationStartDate || null,
          representationEndDate: form.representationEndDate || null,
          agreedCommissionRate: form.agreedCommissionRate ? Number(form.agreedCommissionRate) : null,
        }),
      });
      setEditing(null);
      load();
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--primary)" }} />;

  return (
    <div className="space-y-3">
      {owners.length === 0 ? (
        <p className="text-sm text-center py-12" style={{ color: "var(--text-muted)" }}>
          {tri(lang, "هنوز مالکی ثبت نشده — یک مخاطب را در فرم ثبت ملک به‌عنوان مالک انتخاب کنید", "No owners yet — link a contact as owner when creating a property", "Noch keine Eigentümer — verknüpfen Sie einen Kontakt beim Anlegen einer Immobilie")}
        </p>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          {owners.map((o, i) => (
            <div key={o.id} style={{ background: "var(--surface-1)", borderTop: i > 0 ? "1px solid var(--border)" : undefined }}>
              <button onClick={() => setExpanded(expanded === o.id ? null : o.id)} className="w-full flex items-center justify-between px-4 py-3 text-right">
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{o.name}</p>
                  <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{o.phone || o.email || "—"}</p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(234,88,12,0.12)", color: "var(--primary)" }}>
                  {o.propertiesOwnedCount} {tri(lang, "ملک", "properties", "Immobilien")}
                </span>
              </button>
              {expanded === o.id && (
                <div className="px-4 pb-3 space-y-2">
                  {o.properties.map((p) => (
                    <div key={p.id} className="rounded-xl p-3 space-y-2" style={{ background: "var(--surface-2)" }}>
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{p.title} — {p.address}{p.city ? `${tri(lang, "،", ",", ",")} ${p.city}` : ""}</p>
                        {editing?.propertyId !== p.id && (
                          <button onClick={() => startEdit(o.id, p)} className="text-[11px]" style={{ color: "var(--primary)" }}>
                            {tri(lang, "ویرایش قرارداد", "Edit terms", "Bedingungen bearbeiten")}
                          </button>
                        )}
                      </div>
                      {editing?.propertyId === p.id ? (
                        <div className="grid grid-cols-3 gap-2">
                          <input type="date" value={form.representationStartDate} onChange={(e) => setForm({ ...form, representationStartDate: e.target.value })}
                            className="px-2 py-1.5 rounded-lg text-xs outline-none" style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                          <input type="date" value={form.representationEndDate} onChange={(e) => setForm({ ...form, representationEndDate: e.target.value })}
                            className="px-2 py-1.5 rounded-lg text-xs outline-none" style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                          <input type="number" step="0.1" value={form.agreedCommissionRate} onChange={(e) => setForm({ ...form, agreedCommissionRate: e.target.value })}
                            placeholder={tri(lang, "کمیسیون %", "Commission %", "Provision %")}
                            className="px-2 py-1.5 rounded-lg text-xs outline-none" style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                          <div className="col-span-3 flex gap-2">
                            <button onClick={saveRepresentation} disabled={saving} className="flex-1 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50" style={{ background: "var(--primary)" }}>
                              {saving ? "..." : tri(lang, "ذخیره", "Save", "Speichern")}
                            </button>
                            <button onClick={() => setEditing(null)} className="flex-1 py-1.5 rounded-lg text-xs" style={{ background: "var(--surface-1)", color: "var(--text-secondary)" }}>
                              {tri(lang, "لغو", "Cancel", "Abbrechen")}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                          {tri(lang, "بازه قرارداد:", "Agreement period:", "Vertragszeitraum:")} {p.representationStartDate ? p.representationStartDate.slice(0, 10) : "—"} → {p.representationEndDate ? p.representationEndDate.slice(0, 10) : "—"}
                          {" · "}{tri(lang, "کمیسیون:", "Commission:", "Provision:")} {p.agreedCommissionRate != null ? `${p.agreedCommissionRate}%` : "—"}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Section 1, item 4 — Viewing Scheduler. A real calendar slot per PropertyViewing row (not a text field), server-side double-booking check per assigned team member (src/app/api/crm/viewings). Post-viewing feedback capture built in. */
function ViewingsPanel({ lang, teamMembers, viewingCoordinatorEnabled }: { lang: Lang; teamMembers: TeamMember[]; viewingCoordinatorEnabled: boolean }) {
  const [viewings, setViewings] = useState<ViewingRow[]>([]);
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedbackTarget, setFeedbackTarget] = useState<ViewingRow | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackRating, setFeedbackRating] = useState("");

  const [propertyId, setPropertyId] = useState("");
  const [contactId, setContactId] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [autoSlot, setAutoSlot] = useState(true);

  const [needsFeedback, setNeedsFeedback] = useState<{ id: string; scheduledAt: string; property: { title: string }; contact: { name: string } | null }[]>([]);

  const load = useCallback(async () => {
    const [vRes, pRes] = await Promise.all([fetch("/api/crm/viewings"), fetch("/api/crm/properties")]);
    const vData = await vRes.json();
    const pData = await pRes.json();
    setViewings(vData.viewings || []);
    setProperties(pData.properties || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!viewingCoordinatorEnabled) return;
    fetch("/api/crm/viewings/needs-feedback").then((r) => r.json()).then((d) => setNeedsFeedback(d.viewings || [])).catch(() => {});
  }, [viewingCoordinatorEnabled, viewings]);

  async function createViewing() {
    if (!propertyId) { setError(tri(lang, "ملک الزامی است", "Property is required", "Immobilie ist erforderlich")); return; }
    if (!scheduledAt) { setError(tri(lang, "زمان بازدید الزامی است", "Viewing time is required", "Besichtigungszeit ist erforderlich")); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/crm/viewings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId, contactId: contactId || undefined, assignedToId: assignedToId || undefined, scheduledAt,
          autoSlot: viewingCoordinatorEnabled && !!assignedToId && autoSlot,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.autoRescheduled) {
        alert(tri(lang,
          `زمان درخواستی پر بود — بازدید در نزدیک‌ترین بازه آزاد (${new Date(data.viewing.scheduledAt).toLocaleString("fa-IR")}) ثبت شد.`,
          `The requested time was busy — booked at the nearest free slot (${new Date(data.viewing.scheduledAt).toLocaleString()}) instead.`,
          `Der gewünschte Termin war belegt — auf den nächsten freien Slot (${new Date(data.viewing.scheduledAt).toLocaleString()}) gebucht.`));
      }
      setShowNew(false);
      setPropertyId(""); setContactId(""); setAssignedToId(""); setScheduledAt("");
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : tri(lang, "خطا در ثبت بازدید", "Failed to book viewing", "Fehler beim Buchen der Besichtigung"));
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(id: string, status: string) {
    await fetch(`/api/crm/viewings/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    load();
  }

  async function deleteViewing(id: string) {
    await fetch(`/api/crm/viewings/${id}`, { method: "DELETE" });
    load();
  }

  async function saveFeedback() {
    if (!feedbackTarget) return;
    await fetch(`/api/crm/viewings/${feedbackTarget.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feedback: feedbackText, feedbackRating: feedbackRating ? Number(feedbackRating) : null, status: "completed" }),
    });
    setFeedbackTarget(null);
    setFeedbackText(""); setFeedbackRating("");
    load();
  }

  const STATUS_LABEL: Record<string, Record<Lang, string>> = {
    scheduled: { fa: "برنامه‌ریزی‌شده", en: "Scheduled", de: "Geplant" },
    completed: { fa: "انجام‌شده", en: "Completed", de: "Abgeschlossen" },
    cancelled: { fa: "لغوشده", en: "Cancelled", de: "Storniert" },
    no_show: { fa: "عدم حضور", en: "No-show", de: "Nicht erschienen" },
  };

  if (loading) return <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--primary)" }} />;

  return (
    <div className="space-y-3">
      {/* Section 2, item 3 — Viewing Coordinator: post-viewing feedback nudge. Only a display/reminder — never messages the customer automatically. */}
      {viewingCoordinatorEnabled && needsFeedback.length > 0 && (
        <div className="rounded-2xl p-3" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)" }}>
          <p className="text-xs font-medium" style={{ color: "#f59e0b" }}>
            {tri(lang, `${needsFeedback.length} بازدید گذشته هنوز بازخورد ثبت نشده دارند`, `${needsFeedback.length} past viewings still need feedback logged`, `${needsFeedback.length} vergangene Besichtigungen brauchen noch Rückmeldung`)}
          </p>
        </div>
      )}

      <div className="flex justify-end">
        <button onClick={() => setShowNew((v) => !v)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: "var(--primary)" }}>
          <Plus className="w-4 h-4" /> {tri(lang, "بازدید جدید", "New viewing", "Neue Besichtigung")}
        </button>
      </div>

      {showNew && (
        <div className="rounded-2xl p-4 space-y-2" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)}
            className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
            <option value="">{tri(lang, "انتخاب ملک", "Select property", "Immobilie auswählen")}</option>
            {properties.map((p) => <option key={p.id} value={p.id}>{p.title} — {p.address}</option>)}
          </select>
          <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)}
            className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <select value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)}
            className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
            <option value="">{tri(lang, "کارشناس (اختیاری)", "Agent (optional)", "Makler (optional)")}</option>
            {teamMembers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          {viewingCoordinatorEnabled && assignedToId && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={autoSlot} onChange={(e) => setAutoSlot(e.target.checked)} className="w-4 h-4 accent-orange-500" />
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {tri(lang, "اگر این زمان پر بود، نزدیک‌ترین بازه آزاد را خودکار پیدا کن", "If this time is busy, automatically find the nearest free slot", "Falls dieser Termin belegt ist, automatisch den nächsten freien Slot finden")}
              </span>
            </label>
          )}
          {error && <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>}
          <button onClick={createViewing} disabled={saving} className="w-full py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--primary)" }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : tri(lang, "ثبت بازدید", "Book viewing", "Besichtigung buchen")}
          </button>
        </div>
      )}

      {viewings.length === 0 ? (
        <p className="text-sm text-center py-12" style={{ color: "var(--text-muted)" }}>{tri(lang, "هنوز بازدیدی ثبت نشده است", "No viewings yet", "Noch keine Besichtigungen")}</p>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          {viewings.map((v, i) => (
            <div key={v.id} className="flex items-center justify-between px-4 py-3 flex-wrap gap-2" style={{ background: "var(--surface-1)", borderTop: i > 0 ? "1px solid var(--border)" : undefined }}>
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{v.property.title} — {v.property.address}</p>
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  {new Date(v.scheduledAt).toLocaleString(lang === "fa" ? "fa-IR" : "en-US")}
                  {v.contact ? ` · ${v.contact.name}` : ""}{v.assignedTo ? ` · ${v.assignedTo.name}` : ""}
                </p>
                {v.feedback && <p className="text-[11px] mt-1" style={{ color: "var(--text-secondary)" }}>{tri(lang, "بازخورد:", "Feedback:", "Rückmeldung:")} {v.feedback}{v.feedbackRating ? ` (${v.feedbackRating}/5)` : ""}</p>}
              </div>
              <div className="flex items-center gap-2">
                <select value={v.status} onChange={(e) => setStatus(v.id, e.target.value)}
                  className="text-[10px] px-2 py-1 rounded-full font-medium outline-none" style={{ background: "var(--surface-2)", color: "var(--text-secondary)", border: "none" }}>
                  {Object.entries(STATUS_LABEL).map(([val, l]) => <option key={val} value={val}>{l[lang]}</option>)}
                </select>
                {v.status !== "completed" && (
                  <button onClick={() => { setFeedbackTarget(v); setFeedbackText(v.feedback || ""); setFeedbackRating(v.feedbackRating ? String(v.feedbackRating) : ""); }}
                    className="text-[11px]" style={{ color: "var(--primary)" }}>
                    {tri(lang, "ثبت بازخورد", "Add feedback", "Rückmeldung")}
                  </button>
                )}
                <button onClick={() => deleteViewing(v.id)}><Trash2 className="w-4 h-4" style={{ color: "#ef4444" }} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {feedbackTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="w-full max-w-md rounded-2xl p-5 space-y-3" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{tri(lang, "بازخورد پس از بازدید", "Post-viewing feedback", "Rückmeldung nach der Besichtigung")}</h3>
            <textarea value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)} rows={3}
              placeholder={tri(lang, "نظر خریدار/کارشناس درباره ملک", "Buyer/agent's impression of the property", "Eindruck des Käufers/Maklers")}
              className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            <select value={feedbackRating} onChange={(e) => setFeedbackRating(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
              <option value="">{tri(lang, "امتیاز (اختیاری)", "Rating (optional)", "Bewertung (optional)")}</option>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}/5</option>)}
            </select>
            <div className="flex gap-2">
              <button onClick={saveFeedback} className="flex-1 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: "var(--primary)" }}>{tri(lang, "ذخیره", "Save", "Speichern")}</button>
              <button onClick={() => setFeedbackTarget(null)} className="flex-1 py-2 rounded-xl text-sm" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>{tri(lang, "لغو", "Cancel", "Abbrechen")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Section 1, item 3 — Buyer↔Property match view, feeding the Lead Matcher agent (Section 2). Buyer criteria live in CrmContact.customFields.buyerCriteria — reuses the existing contacts PUT endpoint to save, only this read-side matching view is new. */
function BuyerMatchPanel({ lang, leadMatcherAgentEnabled }: { lang: Lang; leadMatcherAgentEnabled: boolean }) {
  const [results, setResults] = useState<BuyerMatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState<{ id: string; name: string }[]>([]);
  const [showSetCriteria, setShowSetCriteria] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [listingType, setListingType] = useState("");
  const [city, setCity] = useState("");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [minBedrooms, setMinBedrooms] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [leadDrafts, setLeadDrafts] = useState<{ contactId: string; name: string; email: string | null; matchedPropertyIds: string[]; message: string }[]>([]);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [sendingDraftId, setSendingDraftId] = useState<string | null>(null);
  const [sentDraftIds, setSentDraftIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const [mRes, cRes] = await Promise.all([fetch("/api/crm/buyer-matches"), fetch("/api/crm/contacts")]);
    const mData = await mRes.json();
    const cData = await cRes.json();
    setResults(mData.results || []);
    setContacts((cData.contacts || []).map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function saveCriteria() {
    if (!selectedContactId) { setError(tri(lang, "یک مخاطب انتخاب کنید", "Select a contact", "Kontakt auswählen")); return; }
    setSaving(true);
    setError("");
    try {
      const buyerCriteria: Record<string, unknown> = {};
      if (propertyType) buyerCriteria.propertyType = propertyType;
      if (listingType) buyerCriteria.listingType = listingType;
      if (city) buyerCriteria.city = city;
      if (budgetMin) buyerCriteria.budgetMin = Number(budgetMin);
      if (budgetMax) buyerCriteria.budgetMax = Number(budgetMax);
      if (minBedrooms) buyerCriteria.minBedrooms = Number(minBedrooms);

      const res = await fetch(`/api/crm/contacts/${selectedContactId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customFields: { buyerCriteria } }),
      });
      if (!res.ok) throw new Error();
      setShowSetCriteria(false);
      setSelectedContactId(""); setPropertyType(""); setListingType(""); setCity(""); setBudgetMin(""); setBudgetMax(""); setMinBedrooms("");
      load();
    } catch {
      setError(tri(lang, "خطا در ذخیره معیارها", "Failed to save criteria", "Fehler beim Speichern"));
    } finally {
      setSaving(false);
    }
  }

  async function loadLeadMatcherDrafts() {
    setLoadingDrafts(true);
    try {
      const res = await fetch("/api/crm/lead-matcher");
      const data = await res.json();
      setLeadDrafts(data.drafts || []);
    } finally {
      setLoadingDrafts(false);
    }
  }

  async function sendLeadDraft(d: { contactId: string; message: string }) {
    setSendingDraftId(d.contactId);
    try {
      const res = await fetch("/api/sales/followups/send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId: d.contactId, message: d.message }),
      });
      if (res.ok) setSentDraftIds((prev) => new Set(prev).add(d.contactId));
    } finally {
      setSendingDraftId(null);
    }
  }

  if (loading) return <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--primary)" }} />;

  return (
    <div className="space-y-3">
      {/* Section 2, item 1 — Lead Matcher agent. Proposes ready-to-send follow-up drafts only; a human must click send. Falls back to a generic (no-property) draft when a lead has no saved criteria or no property matched — never errors. */}
      {leadMatcherAgentEnabled && (
        <div className="rounded-2xl p-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
            <div>
              <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{tri(lang, "ایجنت تطبیق لید", "Lead Matcher agent", "Lead-Matcher-Agent")}</h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{tri(lang, "پیش‌نویس پیام پیگیری برای لیدها — با اشاره به ملک منطبق در صورت وجود", "Follow-up message drafts for leads — mentioning a matching property where one exists", "Follow-up-Entwürfe für Leads — mit passender Immobilie, falls vorhanden")}</p>
            </div>
            <button onClick={loadLeadMatcherDrafts} disabled={loadingDrafts}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold disabled:opacity-50"
              style={{ background: "var(--surface-2)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
              {loadingDrafts ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {tri(lang, "تولید پیش‌نویس", "Generate drafts", "Entwürfe generieren")}
            </button>
          </div>
          {leadDrafts.length === 0 && !loadingDrafts ? (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{tri(lang, "روی «تولید پیش‌نویس» بزنید", "Click \"Generate drafts\"", "Klicken Sie auf \"Entwürfe generieren\"")}</p>
          ) : (
            <div className="space-y-2">
              {leadDrafts.map((d) => {
                const sent = sentDraftIds.has(d.contactId);
                return (
                  <div key={d.contactId} className="rounded-xl p-3 flex items-start justify-between gap-3" style={{ background: "var(--surface-2)" }}>
                    <div className="flex-1">
                      <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                        {d.name}{d.matchedPropertyIds.length > 0 && <span className="mr-1.5 text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e" }}>{tri(lang, "با ملک منطبق", "with match", "mit Treffer")}</span>}
                      </p>
                      <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>{d.message}</p>
                    </div>
                    {sent ? (
                      <span className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg flex-shrink-0" style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e" }}>
                        <Check className="w-3.5 h-3.5" />{tri(lang, "ارسال شد", "Sent", "Gesendet")}
                      </span>
                    ) : d.email ? (
                      <button onClick={() => sendLeadDraft(d)} disabled={sendingDraftId === d.contactId}
                        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg flex-shrink-0 disabled:opacity-50"
                        style={{ background: "var(--primary)", color: "white" }}>
                        {sendingDraftId === d.contactId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        {tri(lang, "ارسال", "Send", "Senden")}
                      </button>
                    ) : (
                      <span className="text-xs px-2.5 py-1.5 rounded-lg flex-shrink-0" style={{ background: "var(--surface-1)", color: "var(--text-muted)" }}>{tri(lang, "بدون ایمیل", "No email", "Keine E-Mail")}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end">
        <button onClick={() => setShowSetCriteria((v) => !v)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: "var(--primary)" }}>
          <Plus className="w-4 h-4" /> {tri(lang, "تعیین معیار خریدار", "Set buyer criteria", "Käuferkriterien festlegen")}
        </button>
      </div>

      {showSetCriteria && (
        <div className="rounded-2xl p-4 space-y-2" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <select value={selectedContactId} onChange={(e) => setSelectedContactId(e.target.value)}
            className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
            <option value="">{tri(lang, "انتخاب مخاطب خریدار", "Select buyer contact", "Käuferkontakt auswählen")}</option>
            {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <select value={propertyType} onChange={(e) => setPropertyType(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
              <option value="">{tri(lang, "نوع ملک (هر نوع)", "Property type (any)", "Immobilientyp (alle)")}</option>
              {Object.entries(PROPERTY_TYPE_LABEL).map(([val, l]) => <option key={val} value={val}>{l[lang]}</option>)}
            </select>
            <select value={listingType} onChange={(e) => setListingType(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
              <option value="">{tri(lang, "نوع معامله (هر نوع)", "Deal type (any)", "Geschäftsart (alle)")}</option>
              <option value="buy">{tri(lang, "خرید", "Buy", "Kauf")}</option>
              <option value="rent">{tri(lang, "اجاره", "Rent", "Miete")}</option>
            </select>
          </div>
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder={tri(lang, "شهر (هر شهر)", "City (any)", "Stadt (alle)")}
            className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <div className="grid grid-cols-3 gap-2">
            <input value={budgetMin} onChange={(e) => setBudgetMin(e.target.value)} type="number" placeholder={tri(lang, "حداقل بودجه", "Min budget", "Min. Budget")}
              className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            <input value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} type="number" placeholder={tri(lang, "حداکثر بودجه", "Max budget", "Max. Budget")}
              className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            <input value={minBedrooms} onChange={(e) => setMinBedrooms(e.target.value)} type="number" placeholder={tri(lang, "حداقل خواب", "Min bedrooms", "Min. Schlafzimmer")}
              className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          </div>
          {error && <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>}
          <button onClick={saveCriteria} disabled={saving} className="w-full py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--primary)" }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : tri(lang, "ذخیره معیارها", "Save criteria", "Kriterien speichern")}
          </button>
        </div>
      )}

      {results.length === 0 ? (
        <p className="text-sm text-center py-12" style={{ color: "var(--text-muted)" }}>{tri(lang, "هنوز هیچ خریداری معیار جستجو ندارد", "No buyers have search criteria yet", "Noch keine Käuferkriterien")}</p>
      ) : (
        <div className="space-y-3">
          {results.map((r) => (
            <div key={r.contactId} className="rounded-2xl p-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{r.contactName}{r.phone ? ` · ${r.phone}` : ""}</p>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: r.matches.length > 0 ? "rgba(34,197,94,0.1)" : "var(--surface-2)", color: r.matches.length > 0 ? "#22c55e" : "var(--text-muted)" }}>
                  {r.matches.length} {tri(lang, "ملک منطبق", "matches", "Treffer")}
                </span>
              </div>
              {r.matches.length > 0 && (
                <div className="space-y-1.5">
                  {r.matches.map((m) => (
                    <div key={m.id} className="flex items-center justify-between px-3 py-2 rounded-xl text-xs" style={{ background: "var(--surface-2)" }}>
                      <span style={{ color: "var(--text-primary)" }}>{m.title} — {m.address}{m.city ? `${tri(lang, "،", ",", ",")} ${m.city}` : ""}</span>
                      <span style={{ color: "var(--primary)" }}>{fmtMoney(m.price)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface PerformanceRow {
  agentId: string; agentName: string | null;
  propertiesClosedCount: number; commissionVolume: number;
  viewingsScheduled: number; viewingsCompleted: number;
  viewingToContractConversionRate: number | null;
}

function isoDate(d: Date) { return d.toISOString().slice(0, 10); }

/** Section 1, item 8 — Agent/Team performance report. Has no storage of its own — every figure is computed from CrmDeal (item 5) and PropertyViewing (item 4) rows already created elsewhere, not a separate ledger. */
function PerformanceReportPanel({ lang, agencyManagerEnabled }: { lang: Lang; agencyManagerEnabled: boolean }) {
  const today = new Date();
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const [startDate, setStartDate] = useState(isoDate(monthAgo));
  const [endDate, setEndDate] = useState(isoDate(today));
  const [report, setReport] = useState<PerformanceRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [periodDays, setPeriodDays] = useState("7");
  const [agencyReport, setAgencyReport] = useState("");
  const [generatingAgencyReport, setGeneratingAgencyReport] = useState(false);
  const [agencyReportError, setAgencyReportError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/crm/performance-report?startDate=${startDate}&endDate=${endDate}`);
    const data = await res.json();
    setReport(data.report || []);
    setLoading(false);
  }, [startDate, endDate]);

  useEffect(() => { load(); }, [load]);

  async function generateAgencyReport() {
    setGeneratingAgencyReport(true);
    setAgencyReportError("");
    setAgencyReport("");
    try {
      const res = await fetch(`/api/crm/agency-report?periodDays=${periodDays}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAgencyReport(data.report);
    } catch (err: unknown) {
      setAgencyReportError(err instanceof Error ? err.message : tri(lang, "خطا در تولید گزارش", "Failed to generate report", "Fehler beim Erstellen des Berichts"));
    } finally {
      setGeneratingAgencyReport(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Section 2, item 6 — Agency Manager Assistant. Purely reportive/suggestive — the report text itself is written to ask questions per stale item, never to just dump numbers; nothing here writes to any CRM record. */}
      {agencyManagerEnabled && (
        <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{tri(lang, "دستیار مدیر آژانس", "Agency Manager Assistant", "Assistent der Agenturleitung")}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{tri(lang, "خلاصهٔ دوره‌ای Pipeline + سوالات پیشنهادی درباره لیدهای رهاشده و بازدیدهای بدون بازخورد", "Periodic pipeline summary + suggested questions about abandoned leads and feedback-less viewings", "Regelmäßige Pipeline-Zusammenfassung + Fragen zu inaktiven Leads und Besichtigungen ohne Rückmeldung")}</p>
            </div>
            <div className="flex items-center gap-2">
              <select value={periodDays} onChange={(e) => setPeriodDays(e.target.value)}
                className="px-2 py-1.5 rounded-lg text-xs outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                <option value="7">{tri(lang, "هفتگی", "Weekly", "Wöchentlich")}</option>
                <option value="14">{tri(lang, "دو‌هفتگی", "Bi-weekly", "Zweiwöchentlich")}</option>
                <option value="30">{tri(lang, "ماهانه", "Monthly", "Monatlich")}</option>
              </select>
              <button onClick={generateAgencyReport} disabled={generatingAgencyReport} className="text-xs px-3 py-1.5 rounded-lg text-white disabled:opacity-50 flex items-center gap-1.5" style={{ background: "var(--primary)" }}>
                {generatingAgencyReport ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {tri(lang, "تولید گزارش", "Generate report", "Bericht erstellen")}
              </button>
            </div>
          </div>
          {agencyReportError && <p className="text-xs" style={{ color: "#ef4444" }}>{agencyReportError}</p>}
          {agencyReport && (
            <div className="rounded-xl p-3 prose prose-invert prose-sm max-w-none" style={{ background: "var(--surface-2)", color: "var(--text-primary)" }}>
              <ReactMarkdown>{agencyReport}</ReactMarkdown>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
          className="px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
        <span className="text-sm" style={{ color: "var(--text-muted)" }}>{tri(lang, "تا", "to", "bis")}</span>
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
          className="px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
      </div>

      {loading ? (
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--primary)" }} />
      ) : report.length === 0 ? (
        <p className="text-sm text-center py-12" style={{ color: "var(--text-muted)" }}>{tri(lang, "داده‌ای در این بازه یافت نشد", "No data in this range", "Keine Daten in diesem Zeitraum")}</p>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          {report.map((r, i) => (
            <div key={r.agentId} className="px-4 py-3" style={{ background: "var(--surface-1)", borderTop: i > 0 ? "1px solid var(--border)" : undefined }}>
              <p className="text-sm font-medium mb-2" style={{ color: "var(--text-primary)" }}>{r.agentName || tri(lang, "بدون نام", "Unnamed", "Unbenannt")}</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <div>
                  <p style={{ color: "var(--text-muted)" }}>{tri(lang, "ملک بسته‌شده", "Properties closed", "Abgeschlossene Immobilien")}</p>
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{r.propertiesClosedCount}</p>
                </div>
                <div>
                  <p style={{ color: "var(--text-muted)" }}>{tri(lang, "حجم کمیسیون", "Commission volume", "Provisionsvolumen")}</p>
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{fmtMoney(r.commissionVolume)}</p>
                </div>
                <div>
                  <p style={{ color: "var(--text-muted)" }}>{tri(lang, "بازدید انجام‌شده", "Viewings completed", "Abgeschlossene Besichtigungen")}</p>
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{r.viewingsCompleted} / {r.viewingsScheduled}</p>
                </div>
                <div>
                  <p style={{ color: "var(--text-muted)" }}>{tri(lang, "نرخ تبدیل بازدید→قرارداد", "Viewing→contract rate", "Besichtigung→Vertrag-Rate")}</p>
                  <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{r.viewingToContractConversionRate != null ? `${r.viewingToContractConversionRate}%` : "—"}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectDetailModal({ isFa, lang, t, project, onClose, onChanged }: { isFa: boolean; lang: Lang; t: Translations["crm"]; project: CrmProjectRow | null; onClose: () => void; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: project?.name || "", description: project?.description || "",
    startDate: project?.startDate ? project.startDate.slice(0, 10) : "",
    endDate: project?.endDate ? project.endDate.slice(0, 10) : "",
  });
  const [reForm, setReForm] = useState({
    propertyType: project?.property?.propertyType || "apartment",
    address: project?.property?.address || "",
    city: project?.property?.city || "",
    price: project?.property?.price ? String(project.property.price) : "",
    nightlyPrice: project?.property?.nightlyPrice ? String(project.property.nightlyPrice) : "",
    bookingLink: project?.property?.bookingLink || "",
  });

  if (!project) return null;
  const st = PROJECT_STATUS_LABEL[project.status] || PROJECT_STATUS_LABEL.active;
  const isShortTerm = project.property?.listingType === "short_term_rent";

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/crm/projects/${project!.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form, startDate: form.startDate || null, endDate: form.endDate || null,
          realEstate: project!.property ? {
            propertyType: reForm.propertyType, address: reForm.address, city: reForm.city,
            price: isShortTerm ? undefined : reForm.price, nightlyPrice: isShortTerm ? reForm.nightlyPrice : undefined,
            bookingLink: reForm.bookingLink,
          } : undefined,
        }),
      });
      const data = await res.json();
      if (data.bookingLinkWarning) alert(data.bookingLinkWarning);
      setEditing(false);
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{project.name}</h2>
        <button onClick={onClose}><X className="w-5 h-5" style={{ color: "var(--text-muted)" }} /></button>
      </div>

      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] px-2 py-1 rounded-full font-medium" style={{ background: "var(--surface-2)", color: st.color }}>
          {lang === "fa" ? st.fa : lang === "de" ? (st as any).de || st.en : st.en}
        </span>
        {!editing ? (
          <button onClick={() => setEditing(true)} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
            {t.contactDetail.edit}
          </button>
        ) : (
          <div className="flex gap-1.5">
            <button onClick={save} disabled={saving} className="px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50" style={{ background: "var(--primary)" }}>
              {t.contactDetail.save}
            </button>
            <button onClick={() => setEditing(false)} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
              {t.contactDetail.cancel}
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={3}
            className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>{tri(lang, "تاریخ شروع", "Start date", "Startdatum")}</label>
              <input type="date" value={form.startDate} onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>{tri(lang, "تاریخ پایان", "End date", "Enddatum")}</label>
              <input type="date" value={form.endDate} onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            </div>
          </div>

          {project.property && (
            <div className="pt-2 space-y-2" style={{ borderTop: "1px solid var(--border)" }}>
              <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                {PROJECT_LISTING_TYPE_LABEL[project.property.listingType]?.[lang] || project.property.listingType}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <select value={reForm.propertyType} onChange={(e) => setReForm((p) => ({ ...p, propertyType: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                  <option value="apartment">{tri(lang, "آپارتمان", "Apartment", "Wohnung")}</option>
                  <option value="villa">{tri(lang, "ویلا", "Villa", "Villa")}</option>
                  <option value="land">{tri(lang, "زمین", "Land", "Grundstück")}</option>
                  <option value="commercial">{tri(lang, "تجاری", "Commercial", "Gewerbe")}</option>
                </select>
                <input value={reForm.city} onChange={(e) => setReForm((p) => ({ ...p, city: e.target.value }))} placeholder={tri(lang, "شهر", "City", "Stadt")}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
              </div>
              <input value={reForm.address} onChange={(e) => setReForm((p) => ({ ...p, address: e.target.value }))} placeholder={tri(lang, "آدرس", "Address", "Adresse")}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
              {isShortTerm ? (
                <>
                  <input value={reForm.nightlyPrice} onChange={(e) => setReForm((p) => ({ ...p, nightlyPrice: e.target.value }))} type="number" placeholder={tri(lang, "قیمت هر شب (تومان)", "Price per night (Toman)", "Preis pro Nacht (Toman)")}
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                  <input value={reForm.bookingLink} onChange={(e) => setReForm((p) => ({ ...p, bookingLink: e.target.value }))} placeholder={tri(lang, "لینک پلتفرم رزرو", "Booking platform link", "Buchungsplattform-Link")}
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                </>
              ) : (
                <input value={reForm.price} onChange={(e) => setReForm((p) => ({ ...p, price: e.target.value }))} type="number" placeholder={tri(lang, "قیمت کل (تومان)", "Total price (Toman)", "Gesamtpreis (Toman)")}
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2 text-sm">
          {project.description && <p style={{ color: "var(--text-secondary)" }}>{project.description}</p>}
          {project.contact && <div><span style={{ color: "var(--text-muted)" }}>{tri(lang, "مخاطب: ", "Contact: ", "Kontakt: ")}</span><span style={{ color: "var(--text-primary)" }}>{project.contact.name}</span></div>}
          {project.deal && <div><span style={{ color: "var(--text-muted)" }}>{tri(lang, "معامله مرتبط: ", "Related deal: ", "Zugehöriger Deal: ")}</span><span style={{ color: "var(--text-primary)" }}>{project.deal.title}</span></div>}
          {project.startDate && <div><span style={{ color: "var(--text-muted)" }}>{tri(lang, "شروع: ", "Start: ", "Start: ")}</span><span style={{ color: "var(--text-primary)" }}>{toJalali(project.startDate)}</span></div>}
          {project.endDate && <div><span style={{ color: "var(--text-muted)" }}>{tri(lang, "پایان: ", "End: ", "Ende: ")}</span><span style={{ color: "var(--text-primary)" }}>{toJalali(project.endDate)}</span></div>}
          {project.property && (
            <div className="pt-2 mt-2 space-y-1" style={{ borderTop: "1px solid var(--border)" }}>
              <div><span style={{ color: "var(--text-muted)" }}>{tri(lang, "نوع معامله: ", "Deal type: ", "Geschäftsart: ")}</span><span style={{ color: "var(--text-primary)" }}>{PROJECT_LISTING_TYPE_LABEL[project.property.listingType]?.[lang] || project.property.listingType}</span></div>
              <div><span style={{ color: "var(--text-muted)" }}>{tri(lang, "آدرس: ", "Address: ", "Adresse: ")}</span><span style={{ color: "var(--text-primary)" }}>{project.property.address}{project.property.city ? `، ${project.property.city}` : ""}</span></div>
              {isShortTerm ? (
                <>
                  {project.property.nightlyPrice != null && <div><span style={{ color: "var(--text-muted)" }}>{tri(lang, "قیمت هر شب: ", "Per night: ", "Pro Nacht: ")}</span><span style={{ color: "var(--text-primary)" }}>{fmtMoney(project.property.nightlyPrice)}</span></div>}
                  {project.property.bookingLink && (
                    <div>
                      <span style={{ color: "var(--text-muted)" }}>{tri(lang, "لینک رزرو: ", "Booking link: ", "Buchungslink: ")}</span>
                      <a href={project.property.bookingLink} target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)" }}>{project.property.bookingLink}</a>
                    </div>
                  )}
                </>
              ) : (
                project.property.price > 0 && <div><span style={{ color: "var(--text-muted)" }}>{tri(lang, "قیمت: ", "Price: ", "Preis: ")}</span><span style={{ color: "var(--text-primary)" }}>{fmtMoney(project.property.price)}</span></div>
              )}
            </div>
          )}
          {!project.description && !project.contact && !project.deal && !project.startDate && !project.endDate && !project.property && (
            <p style={{ color: "var(--text-muted)" }}>{t.contactDetail.noActivity}</p>
          )}
        </div>
      )}
    </Modal>
  );
}
