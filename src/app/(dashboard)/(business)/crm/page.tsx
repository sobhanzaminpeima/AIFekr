"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Briefcase, Plus, X, Phone, Mail, Building2, Loader2, ChevronDown,
  Users, LayoutGrid, Clock, CheckCircle2, Circle, Zap, FileText, Trash2, Upload, Sparkles, CalendarDays,
  Package, Receipt, FileSignature, Pin, Printer, FolderKanban, PhoneCall,
  MessageCircle, Send,
} from "lucide-react";
import { useTranslation, tri, type Lang } from "@/lib/i18n";
import type { Translations } from "@/lib/i18n/en";
import { toJalali } from "@/lib/utils/jalali";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import ReactMarkdown from "react-markdown";

interface Stage { id: string; name: string; order: number; isWon: boolean; isLost: boolean; }
interface Pipeline { id: string; name: string; industrySlug: string | null; isDefault: boolean; stages: Stage[]; }
interface DealContact { id: string; name: string; phone: string | null; company: string | null; }
interface Deal {
  id: string; title: string; value: number; stageId: string; pipelineId: string;
  status: string; contactId: string; contact: DealContact; expectedCloseDate: string | null; ownerId: string | null;
}
interface Contact {
  id: string; name: string; phone: string | null; email: string | null;
  whatsapp: string | null; telegram: string | null; company: string | null;
  status: string; totalSpent: number; lastContact: string | null; assignedToId?: string | null;
}
interface TeamMember { id: string; name: string; email: string; }
interface Activity { id: string; type: string; content: string; createdAt: string; }
interface Task { id: string; title: string; status: string; dueDate: string | null; }
interface ContactDetail extends Contact {
  deals: Deal[]; activities: Activity[]; tasks: Task[];
}
interface AutomationRule { id: string; name: string; trigger: string; condition: string | null; action: string; isActive: boolean; }
interface CrmDocument { id: string; name: string; type: string; fileUrl: string; createdAt: string; }

type CrmTab = "board" | "contacts" | "automation" | "agent" | "calendar" | "analytics" | "products" | "invoices" | "contracts" | "projects";

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

export default function CrmPage() {
  const { t, lang } = useTranslation();
  const isFa = lang !== "en";
  const c = t.crm;

  const [tab, setTab] = useState<CrmTab>("board");
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

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => setCrmPlan(d.user?.crmPlan || "NONE")).catch(() => setCrmPlan("NONE"));
  }, []);

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
  useEffect(() => { if (tab === "contacts" || tab === "invoices" || tab === "contracts" || tab === "projects") loadContacts(); }, [tab, loadContacts]);
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await loadPipelines();
      setSelectedPipelineId(data.pipeline.id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "خطا");
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
        <CrmSidebar tab={tab} setTab={setTab} c={c} isFa={isFa} />

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
                {pipelines.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            ) : (
              <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{selectedPipeline?.name}</h2>
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
                      <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{stage.name}</span>
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
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                    style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>{c.status}</span>
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
        <InvoicesPanel isFa={isFa} t={c} contacts={contacts} />
      ) : tab === "contracts" ? (
        <ContractsPanel isFa={isFa} t={c} contacts={contacts} />
      ) : (
        <ProjectsPanel isFa={isFa} t={c} contacts={contacts} />
      )}
        </div>
      </div>

      {/* New Deal modal */}
      {showNewDeal && selectedPipeline && (
        <NewDealModal
          isFa={isFa}
          t={c}
          pipeline={selectedPipeline}
          onClose={() => setShowNewDeal(false)}
          onCreated={() => { setShowNewDeal(false); if (selectedPipelineId) loadDeals(selectedPipelineId); }}
        />
      )}

      {/* New Contact modal */}
      {showNewContact && (
        <NewContactModal isFa={isFa} t={c} onClose={() => setShowNewContact(false)} onCreated={() => { setShowNewContact(false); loadContacts(); }} />
      )}

      {/* Deal detail panel */}
      {selectedDealId && (
        <DealDetailModal
          isFa={isFa}
          lang={lang}
          t={c}
          dealId={selectedDealId}
          deal={deals.find((d) => d.id === selectedDealId) || null}
          pipelines={pipelines}
          teamMembers={teamMembers}
          onClose={() => setSelectedDealId(null)}
          onChanged={() => { if (selectedPipelineId) loadDeals(selectedPipelineId); }}
        />
      )}

      {/* Contact detail panel */}
      {selectedContactId && contactDetail && (
        <ContactDetailModal
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

function CrmSidebar({ tab, setTab, c, isFa }: { tab: CrmTab; setTab: (t: CrmTab) => void; c: Translations["crm"]; isFa: boolean }) {
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
  ];

  return (
    <nav
      className="flex md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-1 md:pb-0 -mx-6 px-6 md:mx-0 md:px-0 md:w-52 lg:w-56 md:flex-shrink-0 md:sticky md:top-6 flex-shrink-0"
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

function NewDealModal({ isFa, t, pipeline, onClose, onCreated }: { isFa: boolean; t: Translations["crm"]; pipeline: Pipeline; onClose: () => void; onCreated: () => void }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactId, setContactId] = useState("");
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [stageId, setStageId] = useState(pipeline.stages[0]?.id || "");
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
        body: JSON.stringify({ contactId, pipelineId: pipeline.id, stageId, title: title.trim(), value: Number(value) || 0 }),
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
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{t.newDealModal.title}</h2>
        <button onClick={onClose}><X className="w-5 h-5" style={{ color: "var(--text-muted)" }} /></button>
      </div>
      <div className="space-y-3">
        <select value={contactId} onChange={(e) => setContactId(e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
          <option value="">{t.newDealModal.selectContact}</option>
          {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t.newDealModal.titlePlaceholder}
          className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
        <input value={value} onChange={(e) => setValue(e.target.value)} type="number" placeholder={t.newDealModal.valuePlaceholder}
          className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
        <select value={stageId} onChange={(e) => setStageId(e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
          {pipeline.stages.sort((a, b) => a.order - b.order).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {error && <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>}
        <button onClick={submit} disabled={saving} className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--primary)" }}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : t.newDealModal.submit}
        </button>
      </div>
    </Modal>
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

function NewContactModal({ isFa, t, onClose, onCreated }: { isFa: boolean; t: Translations["crm"]; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [telegram, setTelegram] = useState("");
  const [company, setCompany] = useState("");
  const [source, setSource] = useState("manual");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!name.trim()) { setError(t.newContactModal.errorNameRequired); return; }
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
      onCreated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t.newContactModal.errorGeneric);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{t.newContactModal.title}</h2>
        <button onClick={onClose}><X className="w-5 h-5" style={{ color: "var(--text-muted)" }} /></button>
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
        {error && <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>}
        <button onClick={submit} disabled={saving} className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--primary)" }}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : t.newContactModal.submit}
        </button>
      </div>
    </Modal>
  );
}

function DealDetailModal({ isFa, lang, t, dealId, deal, pipelines, teamMembers, onClose, onChanged }: { isFa: boolean; lang: Lang; t: Translations["crm"]; dealId: string; deal: Deal | null; pipelines: Pipeline[]; teamMembers: TeamMember[]; onClose: () => void; onChanged: () => void }) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [ownerId, setOwnerId] = useState(deal?.ownerId || "");
  const [activities, setActivities] = useState<Activity[]>([]);

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
          <div><span style={{ color: "var(--text-muted)" }}>{tri(lang, "مرحله: ", "Stage: ", "Phase: ")}</span><span style={{ color: "var(--text-primary)" }}>{stage?.name || "—"}</span></div>
          <div><span style={{ color: "var(--text-muted)" }}>{tri(lang, "پایپ‌لاین: ", "Pipeline: ", "Pipeline: ")}</span><span style={{ color: "var(--text-primary)" }}>{pipeline?.name || "—"}</span></div>
          <div><span style={{ color: "var(--text-muted)" }}>{tri(lang, "وضعیت: ", "Status: ", "Status: ")}</span><span style={{ color: "var(--text-primary)" }}>{deal.status}</span></div>
          <div className="col-span-2"><span style={{ color: "var(--text-muted)" }}>{isFa ? "مخاطب: " : "Contact: "}</span><span style={{ color: "var(--text-primary)" }}>{deal.contact.name}{deal.contact.phone ? ` — ${deal.contact.phone}` : ""}</span></div>
          {deal.expectedCloseDate && (
            <div className="col-span-2"><span style={{ color: "var(--text-muted)" }}>{tri(lang, "تاریخ تخمینی بستن: ", "Expected close: ", "Erwarteter Abschluss: ")}</span><span style={{ color: "var(--text-primary)" }}>{toJalali(deal.expectedCloseDate)}</span></div>
          )}
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
            <a href={d.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
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
        name: s.name,
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
          {pipelines.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
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

function InvoicesPanel({ isFa, t, contacts }: { isFa: boolean; t: Translations["crm"]; contacts: Contact[] }) {
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

      {printInvoice && <InvoicePrintModal isFa={isFa} t={t} invoice={printInvoice} onClose={() => setPrintInvoice(null)} />}
    </div>
  );
}

function InvoicePrintModal({ isFa, t, invoice, onClose }: { isFa: boolean; t: Translations["crm"]; invoice: CrmInvoiceRow; onClose: () => void }) {
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
          <span className="text-xs">{isFa ? toJalali(invoice.issueDate) : new Date(invoice.issueDate).toLocaleDateString("en-US")}</span>
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

function ContractsPanel({ isFa, t, contacts }: { isFa: boolean; t: Translations["crm"]; contacts: Contact[] }) {
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

interface CrmProjectRow {
  id: string; name: string; status: string; description: string | null;
  startDate: string | null; endDate: string | null;
  contact: { id: string; name: string } | null; deal: { id: string; title: string } | null;
}

const PROJECT_STATUS_LABEL: Record<string, { fa: string; en: string; color: string }> = {
  active: { fa: "در حال انجام", en: "Active", color: "#3b82f6" },
  on_hold: { fa: "متوقف‌شده", en: "On Hold", color: "#f59e0b" },
  completed: { fa: "تکمیل‌شده", en: "Completed", color: "#22c55e" },
  cancelled: { fa: "لغوشده", en: "Cancelled", color: "var(--text-muted)" },
};

/** Generic post-sale/ongoing-work tracking — usable by any vertical (a construction job, a real-estate closing's paperwork, a service engagement), not tied to one industry's schema. */
function ProjectsPanel({ isFa, t, contacts }: { isFa: boolean; t: Translations["crm"]; contacts: Contact[] }) {
  const [projects, setProjects] = useState<CrmProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [contactId, setContactId] = useState("");
  const [description, setDescription] = useState("");

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
        body: JSON.stringify({ name: name.trim(), contactId: contactId || undefined, description: description.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShowNew(false);
      setName(""); setContactId(""); setDescription("");
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
          isFa={isFa}
          t={t}
          project={projects.find((p) => p.id === selectedProjectId) || null}
          onClose={() => setSelectedProjectId(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}

function ProjectDetailModal({ isFa, t, project, onClose, onChanged }: { isFa: boolean; t: Translations["crm"]; project: CrmProjectRow | null; onClose: () => void; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: project?.name || "", description: project?.description || "",
    startDate: project?.startDate ? project.startDate.slice(0, 10) : "",
    endDate: project?.endDate ? project.endDate.slice(0, 10) : "",
  });

  if (!project) return null;
  const st = PROJECT_STATUS_LABEL[project.status] || PROJECT_STATUS_LABEL.active;

  async function save() {
    setSaving(true);
    try {
      await fetch(`/api/crm/projects/${project!.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, startDate: form.startDate || null, endDate: form.endDate || null }),
      });
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
          {isFa ? st.fa : st.en}
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
              <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>{isFa ? "تاریخ شروع" : "Start date"}</label>
              <input type="date" value={form.startDate} onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: "var(--text-secondary)" }}>{isFa ? "تاریخ پایان" : "End date"}</label>
              <input type="date" value={form.endDate} onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2 text-sm">
          {project.description && <p style={{ color: "var(--text-secondary)" }}>{project.description}</p>}
          {project.contact && <div><span style={{ color: "var(--text-muted)" }}>{isFa ? "مخاطب: " : "Contact: "}</span><span style={{ color: "var(--text-primary)" }}>{project.contact.name}</span></div>}
          {project.deal && <div><span style={{ color: "var(--text-muted)" }}>{isFa ? "معامله مرتبط: " : "Related deal: "}</span><span style={{ color: "var(--text-primary)" }}>{project.deal.title}</span></div>}
          {project.startDate && <div><span style={{ color: "var(--text-muted)" }}>{isFa ? "شروع: " : "Start: "}</span><span style={{ color: "var(--text-primary)" }}>{toJalali(project.startDate)}</span></div>}
          {project.endDate && <div><span style={{ color: "var(--text-muted)" }}>{isFa ? "پایان: " : "End: "}</span><span style={{ color: "var(--text-primary)" }}>{toJalali(project.endDate)}</span></div>}
          {!project.description && !project.contact && !project.deal && !project.startDate && !project.endDate && (
            <p style={{ color: "var(--text-muted)" }}>{t.contactDetail.noActivity}</p>
          )}
        </div>
      )}
    </Modal>
  );
}
