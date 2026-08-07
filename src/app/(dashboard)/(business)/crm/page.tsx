"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Briefcase, Plus, X, Phone, Mail, Building2, Loader2, ChevronDown,
  Users, LayoutGrid, Clock, CheckCircle2, Circle, Zap, FileText, Trash2, Upload, Sparkles, CalendarDays,
  Package, Receipt, FileSignature, Pin, Printer, FolderKanban,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { toJalali } from "@/lib/utils/jalali";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface Stage { id: string; name: string; order: number; isWon: boolean; isLost: boolean; }
interface Pipeline { id: string; name: string; industrySlug: string | null; isDefault: boolean; stages: Stage[]; }
interface DealContact { id: string; name: string; phone: string | null; company: string | null; }
interface Deal {
  id: string; title: string; value: number; stageId: string; pipelineId: string;
  status: string; contactId: string; contact: DealContact; expectedCloseDate: string | null; ownerId: string | null;
}
interface Contact {
  id: string; name: string; phone: string | null; email: string | null; company: string | null;
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
  const { lang } = useTranslation();
  const isFa = lang !== "en";

  const [tab, setTab] = useState<"board" | "contacts" | "automation" | "agent" | "calendar" | "analytics" | "products" | "invoices" | "contracts" | "projects">("board");
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
      if (!res.ok || !data.paymentUrl) throw new Error(data.error || "خطا در شروع پرداخت");
      window.location.href = data.paymentUrl;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "خطا در پرداخت");
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
        body: JSON.stringify(industryChoice ? { industrySlug: industryChoice } : { name: isFa ? "فروش عمومی" : "General Sales" }),
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
    <div dir={isFa ? "rtl" : "ltr"} className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: "rgba(234,88,12,0.15)" }}>
            <Briefcase className="w-5 h-5" style={{ color: "var(--primary)" }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{isFa ? "مدیریت مشتریان (CRM)" : "CRM"}</h1>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{isFa ? "پایپلاین فروش و مخاطبین کسب‌وکار شما" : "Your sales pipeline and business contacts"}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {[
            { id: "board" as const, label: isFa ? "پایپلاین" : "Pipeline", icon: LayoutGrid },
            { id: "contacts" as const, label: isFa ? "مخاطبین" : "Contacts", icon: Users },
            { id: "automation" as const, label: isFa ? "اتوماسیون" : "Automation", icon: Zap },
            { id: "agent" as const, label: isFa ? "تحلیل CRM" : "CRM Agent", icon: Sparkles },
            { id: "calendar" as const, label: isFa ? "تقویم" : "Calendar", icon: CalendarDays },
            { id: "analytics" as const, label: isFa ? "آمار" : "Analytics", icon: LayoutGrid },
            { id: "products" as const, label: isFa ? "محصولات" : "Products", icon: Package },
            { id: "invoices" as const, label: isFa ? "فاکتورها" : "Invoices", icon: Receipt },
            { id: "contracts" as const, label: isFa ? "قراردادها" : "Contracts", icon: FileSignature },
            { id: "projects" as const, label: isFa ? "پروژه‌ها" : "Projects", icon: FolderKanban },
          ].map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all"
              style={{ background: tab === t.id ? "var(--primary)" : "var(--surface-1)", color: tab === t.id ? "white" : "var(--text-secondary)", border: "1px solid var(--border)" }}>
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>
      </div>

      {crmPlan === "NONE" && (
        <div className="rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3" style={{ background: "rgba(234,88,12,0.08)", border: "1px solid rgba(234,88,12,0.3)" }}>
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{isFa ? "فاکتور، قرارداد، کاتالوگ محصولات و اتوماسیون بخشی از افزونه‌ی CRM حرفه‌ای است" : "Invoicing, contracts, product catalog, and automation are part of the CRM Pro add-on"}</p>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{isFa ? "پایپلاین و مخاطبین همچنان رایگان (تا ۲۰ مخاطب) در دسترس‌اند." : "Pipeline and contacts remain free (up to 20 contacts)."}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => purchaseCrmPlan("CRM_SOLO")} disabled={upgrading}
              className="px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50" style={{ background: "var(--surface-1)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
              {isFa ? "CRM انفرادی" : "CRM Solo"}
            </button>
            <button onClick={() => purchaseCrmPlan("CRM_TEAM")} disabled={upgrading}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--primary)" }}>
              {upgrading ? <Loader2 className="w-4 h-4 animate-spin" /> : (isFa ? "CRM تیمی" : "CRM Team")}
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm" style={{ color: "#ef4444" }}>{error}</p>}

      {pipelines.length === 0 && tab === "board" ? (
        <div className="rounded-2xl p-8 text-center space-y-4" style={{ background: "var(--surface-1)", border: "1px dashed var(--border)" }}>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {isFa ? "هنوز هیچ پایپلاینی نساختی. صنعت خودت رو انتخاب کن تا یک پایپلاین آماده با مراحل مناسب برات بسازیم." : "You don't have a pipeline yet. Pick your industry to get a ready-made pipeline with the right stages."}
          </p>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <select value={industryChoice} onChange={(e) => setIndustryChoice(e.target.value)}
              className="px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
              {INDUSTRY_OPTIONS.map((o) => <option key={o.slug} value={o.slug}>{isFa ? o.labelFa : o.labelEn}</option>)}
            </select>
            <button onClick={createPipeline} disabled={creatingPipeline}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--primary)" }}>
              {creatingPipeline ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {isFa ? "ساخت پایپلاین" : "Create Pipeline"}
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
              {isFa ? "خروجی CSV" : "Export CSV"}
            </a>
            <button onClick={() => setShowNewDeal(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: "var(--primary)" }}>
              <Plus className="w-4 h-4" /> {isFa ? "معامله جدید" : "New Deal"}
            </button>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-2">
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
                    <p className="text-[10px] px-1" style={{ color: "var(--text-muted)" }}>{fmtMoney(stageTotal)} {isFa ? "تومان" : ""}</p>
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
          </div>
        </div>
      ) : tab === "contacts" ? (
        <div className="space-y-3">
          <div className="flex justify-end gap-2">
            <a href="/api/crm/export?type=contacts" download
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium" style={{ background: "var(--surface-2)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
              {isFa ? "خروجی CSV" : "Export CSV"}
            </a>
            <button onClick={() => setShowNewContact(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: "var(--primary)" }}>
              <Plus className="w-4 h-4" /> {isFa ? "مخاطب جدید" : "New Contact"}
            </button>
          </div>
          {contacts.length === 0 ? (
            <p className="text-sm text-center py-12" style={{ color: "var(--text-muted)" }}>{isFa ? "هنوز مخاطبی ثبت نشده" : "No contacts yet"}</p>
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
        <AutomationPanel isFa={isFa} rules={rules} onChanged={loadRules} />
      ) : tab === "agent" ? (
        <CrmAgentPanel isFa={isFa} />
      ) : tab === "calendar" ? (
        <CalendarPanel isFa={isFa} />
      ) : tab === "analytics" ? (
        <AnalyticsPanel isFa={isFa} pipelines={pipelines} />
      ) : tab === "products" ? (
        <ProductsPanel isFa={isFa} />
      ) : tab === "invoices" ? (
        <InvoicesPanel isFa={isFa} contacts={contacts} />
      ) : tab === "contracts" ? (
        <ContractsPanel isFa={isFa} contacts={contacts} />
      ) : (
        <ProjectsPanel isFa={isFa} contacts={contacts} />
      )}

      {/* New Deal modal */}
      {showNewDeal && selectedPipeline && (
        <NewDealModal
          isFa={isFa}
          pipeline={selectedPipeline}
          onClose={() => setShowNewDeal(false)}
          onCreated={() => { setShowNewDeal(false); if (selectedPipelineId) loadDeals(selectedPipelineId); }}
        />
      )}

      {/* New Contact modal */}
      {showNewContact && (
        <NewContactModal isFa={isFa} onClose={() => setShowNewContact(false)} onCreated={() => { setShowNewContact(false); loadContacts(); }} />
      )}

      {/* Deal detail panel */}
      {selectedDealId && (
        <DealDetailModal
          isFa={isFa}
          dealId={selectedDealId}
          deal={deals.find((d) => d.id === selectedDealId) || null}
          teamMembers={teamMembers}
          onClose={() => setSelectedDealId(null)}
          onChanged={() => { if (selectedPipelineId) loadDeals(selectedPipelineId); }}
        />
      )}

      {/* Contact detail panel */}
      {selectedContactId && contactDetail && (
        <ContactDetailModal
          isFa={isFa}
          contact={contactDetail}
          teamMembers={teamMembers}
          onClose={() => { setSelectedContactId(null); setContactDetail(null); }}
          onChanged={() => openContact(selectedContactId)}
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

function NewDealModal({ isFa, pipeline, onClose, onCreated }: { isFa: boolean; pipeline: Pipeline; onClose: () => void; onCreated: () => void }) {
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
    if (!contactId || !title.trim()) { setError(isFa ? "مخاطب و عنوان الزامی است" : "Contact and title are required"); return; }
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
      setError(e instanceof Error ? e.message : "خطا");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{isFa ? "معامله جدید" : "New Deal"}</h2>
        <button onClick={onClose}><X className="w-5 h-5" style={{ color: "var(--text-muted)" }} /></button>
      </div>
      <div className="space-y-3">
        <select value={contactId} onChange={(e) => setContactId(e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
          <option value="">{isFa ? "انتخاب مخاطب..." : "Select contact..."}</option>
          {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={isFa ? "عنوان معامله" : "Deal title"}
          className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
        <input value={value} onChange={(e) => setValue(e.target.value)} type="number" placeholder={isFa ? "ارزش معامله (تومان)" : "Deal value"}
          className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
        <select value={stageId} onChange={(e) => setStageId(e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
          {pipeline.stages.sort((a, b) => a.order - b.order).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {error && <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>}
        <button onClick={submit} disabled={saving} className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--primary)" }}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : (isFa ? "ساخت معامله" : "Create Deal")}
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

function NewContactModal({ isFa, onClose, onCreated }: { isFa: boolean; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [source, setSource] = useState("manual");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!name.trim()) { setError(isFa ? "نام الزامی است" : "Name is required"); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/crm/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phone || undefined, email: email || undefined, company: company || undefined, source }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onCreated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "خطا");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{isFa ? "مخاطب جدید" : "New Contact"}</h2>
        <button onClick={onClose}><X className="w-5 h-5" style={{ color: "var(--text-muted)" }} /></button>
      </div>
      <div className="space-y-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={isFa ? "نام" : "Name"}
          className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={isFa ? "موبایل" : "Phone"}
          className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={isFa ? "ایمیل" : "Email"}
          className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
        <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder={isFa ? "شرکت (اختیاری)" : "Company (optional)"}
          className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
        <div>
          <p className="text-xs font-semibold mb-1.5" style={{ color: "var(--text-primary)" }}>{isFa ? "این لید از کجا آمده؟" : "Where did this lead come from?"}</p>
          <select value={source} onChange={(e) => setSource(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
            {LEAD_SOURCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{isFa ? o.fa : o.en}</option>)}
          </select>
        </div>
        {error && <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>}
        <button onClick={submit} disabled={saving} className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--primary)" }}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : (isFa ? "ساخت مخاطب" : "Create Contact")}
        </button>
      </div>
    </Modal>
  );
}

function DealDetailModal({ isFa, dealId, deal, teamMembers, onClose, onChanged }: { isFa: boolean; dealId: string; deal: Deal | null; teamMembers: TeamMember[]; onClose: () => void; onChanged: () => void }) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [ownerId, setOwnerId] = useState(deal?.ownerId || "");

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

  return (
    <Modal onClose={onClose}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{deal?.title || (isFa ? "جزئیات معامله" : "Deal Detail")}</h2>
        <button onClick={onClose}><X className="w-5 h-5" style={{ color: "var(--text-muted)" }} /></button>
      </div>
      <div className="space-y-3">
        {teamMembers.length > 0 && (
          <div>
            <p className="text-xs font-semibold mb-1.5" style={{ color: "var(--text-primary)" }}>{isFa ? "تخصیص به عضو تیم" : "Assign to team member"}</p>
            <select value={ownerId} onChange={(e) => assignOwner(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
              <option value="">{isFa ? "تخصیص‌نیافته" : "Unassigned"}</option>
              {teamMembers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        )}
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder={isFa ? "یادداشت/فعالیت جدید..." : "New note/activity..."}
          className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
        <div className="flex gap-2">
          <button onClick={addActivity} disabled={saving} className="flex-1 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50" style={{ background: "var(--primary)" }}>
            {isFa ? "ثبت فعالیت" : "Log Activity"}
          </button>
          <button onClick={deleteDeal} className="px-4 py-2 rounded-xl text-sm font-medium" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
            {isFa ? "حذف" : "Delete"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ContactDetailModal({ isFa, contact, teamMembers, onClose, onChanged }: { isFa: boolean; contact: ContactDetail; teamMembers: TeamMember[]; onClose: () => void; onChanged: () => void }) {
  const [note, setNote] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [assignedToId, setAssignedToId] = useState(contact.assignedToId || "");

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

  return (
    <Modal onClose={onClose}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{contact.name}</h2>
        <button onClick={onClose}><X className="w-5 h-5" style={{ color: "var(--text-muted)" }} /></button>
      </div>

      <div className="flex flex-wrap gap-3 mb-4 text-xs" style={{ color: "var(--text-secondary)" }}>
        {contact.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{contact.phone}</span>}
        {contact.email && <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{contact.email}</span>}
        {contact.company && <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" />{contact.company}</span>}
      </div>

      {teamMembers.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold mb-1.5" style={{ color: "var(--text-primary)" }}>{isFa ? "تخصیص به عضو تیم" : "Assign to team member"}</p>
          <select value={assignedToId} onChange={(e) => assignTo(e.target.value)}
            className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
            <option value="">{isFa ? "تخصیص‌نیافته" : "Unassigned"}</option>
            {teamMembers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      )}

      {contact.deals.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-primary)" }}>{isFa ? "معاملات" : "Deals"}</p>
          <div className="space-y-1.5">
            {contact.deals.map((d) => (
              <div key={d.id} className="flex items-center justify-between px-3 py-2 rounded-xl text-xs" style={{ background: "var(--surface-2)" }}>
                <span style={{ color: "var(--text-primary)" }}>{d.title}</span>
                <span style={{ color: "var(--text-muted)" }}>{d.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4">
        <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-primary)" }}>{isFa ? "تسک‌ها" : "Tasks"}</p>
        <div className="space-y-1.5 mb-2">
          {contact.tasks.map((t) => (
            <button key={t.id} onClick={() => toggleTask(t.id, t.status)} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-right" style={{ background: "var(--surface-2)" }}>
              {t.status === "done" ? <CheckCircle2 className="w-3.5 h-3.5" style={{ color: "#22c55e" }} /> : <Circle className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />}
              <span style={{ color: t.status === "done" ? "var(--text-muted)" : "var(--text-primary)", textDecoration: t.status === "done" ? "line-through" : "none" }}>{t.title}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder={isFa ? "تسک جدید..." : "New task..."}
            className="flex-1 px-3 py-2 rounded-xl text-xs outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <button onClick={addTask} className="px-3 py-2 rounded-xl text-xs font-medium text-white" style={{ background: "var(--primary)" }}>+</button>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-primary)" }}>{isFa ? "فعالیت‌ها" : "Activity"}</p>
        <div className="space-y-1.5 mb-2 max-h-32 overflow-y-auto">
          {contact.activities.map((a) => (
            <div key={a.id} className="flex items-start gap-2 px-3 py-2 rounded-xl text-xs" style={{ background: "var(--surface-2)" }}>
              <Clock className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
              <span style={{ color: "var(--text-secondary)" }}>{a.content}</span>
            </div>
          ))}
          {contact.activities.length === 0 && <p className="text-xs" style={{ color: "var(--text-muted)" }}>{isFa ? "فعالیتی ثبت نشده" : "No activity yet"}</p>}
        </div>
        <div className="flex gap-2">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={isFa ? "یادداشت جدید..." : "New note..."}
            className="flex-1 px-3 py-2 rounded-xl text-xs outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <button onClick={addActivity} className="px-3 py-2 rounded-xl text-xs font-medium text-white" style={{ background: "var(--primary)" }}>+</button>
        </div>
      </div>

      <PinnedNotesSection isFa={isFa} contactId={contact.id} />
      <DocumentsSection isFa={isFa} contactId={contact.id} />
    </Modal>
  );
}

interface CrmNoteRow { id: string; content: string; isPinned: boolean; createdAt: string; }

function PinnedNotesSection({ isFa, contactId }: { isFa: boolean; contactId: string }) {
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
      <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-primary)" }}>{isFa ? "یادداشت‌های سنجاق‌شده" : "Pinned Notes"}</p>
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
        {notes.length === 0 && <p className="text-xs" style={{ color: "var(--text-muted)" }}>{isFa ? "یادداشتی ثبت نشده" : "No notes yet"}</p>}
      </div>
      <div className="flex gap-2">
        <input value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder={isFa ? "یادداشت جدید..." : "New note..."}
          className="flex-1 px-3 py-2 rounded-xl text-xs outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
        <button onClick={addNote} className="px-3 py-2 rounded-xl text-xs font-medium text-white" style={{ background: "var(--primary)" }}>+</button>
      </div>
    </div>
  );
}

function DocumentsSection({ isFa, contactId }: { isFa: boolean; contactId: string }) {
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
      setError(err instanceof Error ? err.message : "خطا");
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
      <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-primary)" }}>{isFa ? "اسناد (پیش‌فاکتور، قرارداد، فاکتور)" : "Documents"}</p>
      <div className="space-y-1.5 mb-2">
        {documents.map((d) => (
          <div key={d.id} className="flex items-center justify-between px-3 py-2 rounded-xl text-xs" style={{ background: "var(--surface-2)" }}>
            <a href={d.fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
              <FileText className="w-3.5 h-3.5" style={{ color: "var(--primary)" }} /> {d.name}
            </a>
            <button onClick={() => removeDoc(d.id)}><Trash2 className="w-3.5 h-3.5" style={{ color: "#ef4444" }} /></button>
          </div>
        ))}
        {documents.length === 0 && <p className="text-xs" style={{ color: "var(--text-muted)" }}>{isFa ? "سندی آپلود نشده" : "No documents yet"}</p>}
      </div>
      {error && <p className="text-xs mb-2" style={{ color: "#ef4444" }}>{error}</p>}
      <label className="flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium cursor-pointer"
        style={{ background: "var(--surface-2)", border: "1px dashed var(--border)", color: "var(--text-secondary)" }}>
        {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
        {uploading ? (isFa ? "در حال آپلود..." : "Uploading...") : (isFa ? "آپلود سند" : "Upload Document")}
        <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,image/*" onChange={handleUpload} disabled={uploading} className="hidden" />
      </label>
    </div>
  );
}

function AutomationPanel({ isFa, rules, onChanged }: { isFa: boolean; rules: AutomationRule[]; onChanged: () => void }) {
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");
  const [days, setDays] = useState("3");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function createRule() {
    if (!name.trim()) { setError(isFa ? "نام قانون الزامی است" : "Rule name is required"); return; }
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
      setError(err instanceof Error ? err.message : "خطا");
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
        {isFa
          ? "قوانین اتوماسیون هر چند دقیقه یک‌بار بررسی می‌شوند و برای معاملات بازی که مدتی فعالیت نداشته‌اند، به‌طور خودکار یک تسک پیگیری می‌سازند."
          : "Automation rules are checked every few minutes and auto-create a follow-up task for open deals that have had no activity for a while."}
      </p>
      <div className="flex justify-end">
        <button onClick={() => setShowNew((v) => !v)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: "var(--primary)" }}>
          <Plus className="w-4 h-4" /> {isFa ? "قانون جدید" : "New Rule"}
        </button>
      </div>

      {showNew && (
        <div className="rounded-2xl p-4 space-y-2" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={isFa ? "مثال: پیگیری معاملات راکد" : "e.g. Follow up stale deals"}
            className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{isFa ? "اگر معامله‌ای بیش از" : "If a deal has had no activity for more than"}</span>
            <input value={days} onChange={(e) => setDays(e.target.value)} type="number" min={1}
              className="w-16 px-2 py-1.5 rounded-lg text-sm outline-none text-center" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{isFa ? "روز فعالیتی نداشت، یک تسک پیگیری بساز" : "days, create a follow-up task"}</span>
          </div>
          {error && <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>}
          <button onClick={createRule} disabled={saving} className="w-full py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--primary)" }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : (isFa ? "ساخت قانون" : "Create Rule")}
          </button>
        </div>
      )}

      {rules.length === 0 ? (
        <p className="text-sm text-center py-12" style={{ color: "var(--text-muted)" }}>{isFa ? "هنوز قانون اتوماسیونی نساختی" : "No automation rules yet"}</p>
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
                    {isFa ? `معاملات بدون فعالیت بیش از ${days} روز → ساخت تسک پیگیری` : `Deals with no activity for ${days}+ days → create follow-up task`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggleRule(r.id, r.isActive)}
                    className="px-2.5 py-1 rounded-full text-[10px] font-medium"
                    style={{ background: r.isActive ? "rgba(34,197,94,0.15)" : "var(--surface-2)", color: r.isActive ? "#22c55e" : "var(--text-muted)" }}>
                    {r.isActive ? (isFa ? "فعال" : "Active") : (isFa ? "غیرفعال" : "Inactive")}
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

function CrmAgentPanel({ isFa }: { isFa: boolean }) {
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
          {isFa
            ? "CRM Agent وضعیت Pipeline فروش شما را با داده‌های واقعی تحلیل می‌کند و اقدامات پیشنهادی می‌سازد."
            : "The CRM Agent analyzes your sales pipeline using real data and generates suggested actions."}
        </p>
        <button onClick={runAgent} disabled={running}
          className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--primary)" }}>
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {isFa ? "تحلیل CRM من" : "Analyze My CRM"}
        </button>
      </div>

      {analysis && (
        <div className="rounded-2xl p-5 whitespace-pre-wrap text-sm leading-7" style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
          {analysis}
        </div>
      )}

      <div className="space-y-2">
        <h3 className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>{isFa ? "نکات ذخیره‌شده از تحلیل‌های قبلی" : "Saved notes from prior analyses"}</h3>
        {loadingInsights ? (
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--text-muted)" }} />
        ) : insights.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>{isFa ? "هنوز تحلیلی اجرا نشده" : "No analysis run yet"}</p>
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

function CalendarPanel({ isFa }: { isFa: boolean }) {
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
  if (items.length === 0) return <p className="text-sm text-center py-12" style={{ color: "var(--text-muted)" }}>{isFa ? "هیچ تسک یا معامله‌ای با تاریخ سررسید ثبت نشده" : "No tasks or deals with a due/close date"}</p>;

  const grouped = new Map<string, CalendarItem[]>();
  for (const item of items) {
    const day = item.date.slice(0, 10);
    grouped.set(day, [...(grouped.get(day) || []), item]);
  }

  return (
    <div className="space-y-4">
      {Array.from(grouped.entries()).map(([day, dayItems]) => (
        <div key={day} className="rounded-2xl p-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <p className="text-xs font-semibold mb-2" style={{ color: "var(--primary)" }}>{isFa ? toJalali(day) : new Date(day).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
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

function AnalyticsPanel({ isFa, pipelines }: { isFa: boolean; pipelines: Pipeline[] }) {
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

  if (pipelines.length === 0) return <p className="text-sm text-center py-12" style={{ color: "var(--text-muted)" }}>{isFa ? "ابتدا یک پایپلاین بساز" : "Create a pipeline first"}</p>;

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
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{isFa ? "کل معاملات" : "Total Deals"}</p>
              <p className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{totalDeals}</p>
            </div>
            <div className="rounded-2xl p-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{isFa ? "نرخ تبدیل کلی" : "Overall Conversion"}</p>
              <p className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{overallConversion}%</p>
            </div>
          </div>

          <div className="rounded-2xl p-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <p className="text-xs font-semibold mb-3" style={{ color: "var(--text-primary)" }}>{isFa ? "قیف تبدیل بر اساس مرحله" : "Conversion Funnel by Stage"}</p>
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
              <p className="text-xs font-semibold mb-3" style={{ color: "var(--text-primary)" }}>{isFa ? "عملکرد منابع لید" : "Lead Source Performance"}</p>
              <div className="space-y-2">
                {sourceStats.map((s) => (
                  <div key={s.source.value} className="flex items-center justify-between px-3 py-2 rounded-xl text-xs" style={{ background: "var(--surface-2)" }}>
                    <span style={{ color: "var(--text-primary)" }}>{isFa ? s.source.fa : s.source.en}</span>
                    <span style={{ color: "var(--text-secondary)" }}>
                      {s.total} {isFa ? "لید" : "leads"} · {s.converted} {isFa ? "مشتری" : "customers"} · <b style={{ color: "var(--primary)" }}>{s.rate}%</b>
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

interface CrmProduct {
  id: string; name: string; sku: string | null; description: string | null;
  price: number; unit: string | null; taxRate: number; isActive: boolean; imageUrl: string | null;
}

interface ProductFormState {
  id?: string; name: string; sku: string; description: string; price: string; unit: string; taxRate: string; imageUrl: string;
}

const EMPTY_PRODUCT_FORM: ProductFormState = { name: "", sku: "", description: "", price: "", unit: "", taxRate: "0", imageUrl: "" };

function ProductsPanel({ isFa }: { isFa: boolean }) {
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
      setError(err instanceof Error ? err.message : "خطا در آپلود تصویر");
    } finally {
      setUploading(false);
    }
  }

  async function saveProduct() {
    if (!form) return;
    if (!form.name.trim()) { setError(isFa ? "نام محصول الزامی است" : "Product name is required"); return; }
    const priceNum = Number(form.price);
    if (!Number.isFinite(priceNum) || priceNum < 0) { setError(isFa ? "قیمت معتبر الزامی است" : "Valid price is required"); return; }
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
      setError(err instanceof Error ? err.message : "خطا");
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
          <Plus className="w-4 h-4" /> {isFa ? "محصول جدید" : "New Product"}
        </button>
      </div>

      {form && (
        <div className="rounded-2xl p-4 space-y-2 grid grid-cols-2 gap-2" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <div className="col-span-2 flex items-center gap-3">
            <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
              {form.imageUrl ? <img src={form.imageUrl} alt="" className="w-full h-full object-cover" /> : <Package className="w-6 h-6" style={{ color: "var(--text-muted)" }} />}
            </div>
            <label className="text-xs px-3 py-1.5 rounded-lg cursor-pointer" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
              {uploading ? (isFa ? "در حال آپلود..." : "Uploading...") : (isFa ? "آپلود عکس" : "Upload photo")}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={uploading}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); }} />
            </label>
          </div>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={isFa ? "نام محصول/خدمت" : "Product/service name"}
            className="col-span-2 px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={isFa ? "توضیحات (اختیاری)" : "Description (optional)"}
            className="col-span-2 px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder={isFa ? "کد محصول (اختیاری)" : "SKU (optional)"}
            className="px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} type="number" placeholder={isFa ? "قیمت" : "Price"}
            className="px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder={isFa ? "واحد (اختیاری)" : "Unit (optional)"}
            className="px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <input value={form.taxRate} onChange={(e) => setForm({ ...form, taxRate: e.target.value })} type="number" placeholder={isFa ? "درصد مالیات" : "Tax %"}
            className="px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          {error && <p className="col-span-2 text-xs" style={{ color: "#ef4444" }}>{error}</p>}
          <div className="col-span-2 flex gap-2">
            <button onClick={() => setForm(null)} className="flex-1 py-2 rounded-xl text-sm font-medium" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
              {isFa ? "انصراف" : "Cancel"}
            </button>
            <button onClick={saveProduct} disabled={saving} className="flex-1 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--primary)" }}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : (isFa ? "ذخیره" : "Save")}
            </button>
          </div>
        </div>
      )}

      {products.length === 0 ? (
        <p className="text-sm text-center py-12" style={{ color: "var(--text-muted)" }}>{isFa ? "هنوز محصولی ثبت نشده" : "No products yet"}</p>
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
                  <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{fmtMoney(p.price)} {p.unit ? `/ ${p.unit}` : ""} {p.taxRate > 0 ? `· ${p.taxRate}% ${isFa ? "مالیات" : "tax"}` : ""}</p>
                </div>
              </button>
              <div className="flex items-center gap-2">
                <button onClick={() => setForm({ id: p.id, name: p.name, sku: p.sku || "", description: p.description || "", price: String(p.price), unit: p.unit || "", taxRate: String(p.taxRate), imageUrl: p.imageUrl || "" })}
                  className="text-[11px] px-2 py-1 rounded-lg" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
                  {isFa ? "ویرایش" : "Edit"}
                </button>
                <button onClick={() => toggleActive(p)}
                  className="px-2.5 py-1 rounded-full text-[10px] font-medium"
                  style={{ background: p.isActive ? "rgba(34,197,94,0.15)" : "var(--surface-2)", color: p.isActive ? "#22c55e" : "var(--text-muted)" }}>
                  {p.isActive ? (isFa ? "فعال" : "Active") : (isFa ? "غیرفعال" : "Inactive")}
                </button>
                <button onClick={() => deleteProduct(p.id)}><Trash2 className="w-4 h-4" style={{ color: "#ef4444" }} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {detailProduct && <ProductDetailModal isFa={isFa} product={detailProduct} onClose={() => setDetailProduct(null)} />}
    </div>
  );
}

function ProductDetailModal({ isFa, product, onClose }: { isFa: boolean; product: CrmProduct; onClose: () => void }) {
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
      <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-primary)" }}>{isFa ? "مشتریانی که این محصول را خریده‌اند" : "Customers who bought this"}</p>
      {contacts === null ? (
        <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--text-muted)" }} />
      ) : contacts.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>{isFa ? "هنوز در فاکتوری استفاده نشده" : "Not used in any invoice yet"}</p>
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

function InvoicesPanel({ isFa, contacts }: { isFa: boolean; contacts: Contact[] }) {
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
    if (!contactId) { setError(isFa ? "انتخاب مشتری الزامی است" : "Selecting a contact is required"); return; }
    if (items.some((it) => !it.description.trim())) { setError(isFa ? "توضیح همه آیتم‌ها الزامی است" : "All items need a description"); return; }
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
      setError(err instanceof Error ? err.message : "خطا");
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
          <Plus className="w-4 h-4" /> {isFa ? "فاکتور جدید" : "New Invoice"}
        </button>
      </div>

      {showNew && (
        <div className="rounded-2xl p-4 space-y-3" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <select value={contactId} onChange={(e) => setContactId(e.target.value)}
            className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
            <option value="">{isFa ? "انتخاب مشتری..." : "Select contact..."}</option>
            {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <div className="space-y-2">
            {items.map((it, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-1.5 items-center">
                <select onChange={(e) => e.target.value && pickProduct(idx, e.target.value)} defaultValue=""
                  className="col-span-3 px-2 py-1.5 rounded-lg text-xs outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                  <option value="">{isFa ? "از کاتالوگ" : "From catalog"}</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <input value={it.description} onChange={(e) => updateItem(idx, { description: e.target.value })} placeholder={isFa ? "شرح آیتم" : "Item description"}
                  className="col-span-4 px-2 py-1.5 rounded-lg text-xs outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                <input value={it.quantity} onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) || 1 })} type="number" placeholder={isFa ? "تعداد" : "Qty"}
                  className="col-span-2 px-2 py-1.5 rounded-lg text-xs outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                <input value={it.unitPrice} onChange={(e) => updateItem(idx, { unitPrice: Number(e.target.value) || 0 })} type="number" placeholder={isFa ? "قیمت واحد" : "Unit price"}
                  className="col-span-2 px-2 py-1.5 rounded-lg text-xs outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                <button onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))} className="col-span-1"><Trash2 className="w-3.5 h-3.5" style={{ color: "#ef4444" }} /></button>
              </div>
            ))}
            <button onClick={() => setItems((prev) => [...prev, { description: "", quantity: 1, unitPrice: 0, taxRate: 0, lineTotal: 0 }])}
              className="text-xs" style={{ color: "var(--primary)" }}>+ {isFa ? "افزودن آیتم" : "Add item"}</button>
          </div>

          <div className="flex items-center justify-between text-xs" style={{ color: "var(--text-secondary)" }}>
            <div className="flex items-center gap-1.5">
              <span>{isFa ? "تخفیف:" : "Discount:"}</span>
              <input value={discount} onChange={(e) => setDiscount(e.target.value)} type="number"
                className="w-24 px-2 py-1 rounded-lg text-xs outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            </div>
            <span>{isFa ? "جمع کل:" : "Total:"} <b style={{ color: "var(--text-primary)" }}>{fmtMoney(total)}</b></span>
          </div>

          {error && <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>}
          <button onClick={createInvoice} disabled={saving} className="w-full py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--primary)" }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : (isFa ? "ساخت فاکتور" : "Create Invoice")}
          </button>
        </div>
      )}

      {invoices.length === 0 ? (
        <p className="text-sm text-center py-12" style={{ color: "var(--text-muted)" }}>{isFa ? "هنوز فاکتوری ثبت نشده" : "No invoices yet"}</p>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          {invoices.map((inv, i) => {
            const st = INVOICE_STATUS_LABEL[inv.status] || INVOICE_STATUS_LABEL.draft;
            return (
              <div key={inv.id} className="flex items-center justify-between px-4 py-3 flex-wrap gap-2" style={{ background: "var(--surface-1)", borderTop: i > 0 ? "1px solid var(--border)" : undefined }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{inv.invoiceNumber} — {inv.contact.name}</p>
                  <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{fmtMoney(inv.total)} {isFa ? "تومان" : ""}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-medium" style={{ background: "var(--surface-2)", color: st.color }}>{isFa ? st.fa : st.en}</span>
                  {inv.status === "draft" && <button onClick={() => setStatus(inv.id, "sent")} className="text-[11px] px-2 py-1 rounded-lg" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>{isFa ? "ارسال" : "Send"}</button>}
                  {inv.status !== "paid" && inv.status !== "cancelled" && <button onClick={() => setStatus(inv.id, "paid")} className="text-[11px] px-2 py-1 rounded-lg" style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e" }}>{isFa ? "پرداخت شد" : "Mark Paid"}</button>}
                  <button onClick={() => setPrintInvoice(inv)}><Printer className="w-4 h-4" style={{ color: "var(--text-secondary)" }} /></button>
                  <button onClick={() => deleteInvoice(inv.id)}><Trash2 className="w-4 h-4" style={{ color: "#ef4444" }} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {printInvoice && <InvoicePrintModal isFa={isFa} invoice={printInvoice} onClose={() => setPrintInvoice(null)} />}
    </div>
  );
}

function InvoicePrintModal({ isFa, invoice, onClose }: { isFa: boolean; invoice: CrmInvoiceRow; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:p-0 print:static" style={{ background: "rgba(0,0,0,0.6)" }}>
      <div className="print:hidden absolute top-4 left-4 flex gap-2">
        <button onClick={() => window.print()} className="px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: "var(--primary)" }}>{isFa ? "چاپ / PDF" : "Print / PDF"}</button>
        <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium" style={{ background: "var(--surface-2)", color: "var(--text-primary)" }}>{isFa ? "بستن" : "Close"}</button>
      </div>
      <div dir={isFa ? "rtl" : "ltr"} className="w-full max-w-xl rounded-2xl p-8 space-y-4 max-h-[85vh] overflow-y-auto print:max-h-none print:overflow-visible print:shadow-none print:rounded-none"
        style={{ background: "#fff", color: "#111" }}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{isFa ? "فاکتور" : "Invoice"} {invoice.invoiceNumber}</h2>
          <span className="text-xs">{isFa ? toJalali(invoice.issueDate) : new Date(invoice.issueDate).toLocaleDateString("en-US")}</span>
        </div>
        <p className="text-sm">{isFa ? "مشتری:" : "Bill to:"} {invoice.contact.name}</p>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr style={{ borderBottom: "1px solid #ddd" }}>
              <th className="text-right py-1">{isFa ? "شرح" : "Description"}</th>
              <th className="text-right py-1">{isFa ? "تعداد" : "Qty"}</th>
              <th className="text-right py-1">{isFa ? "قیمت واحد" : "Unit"}</th>
              <th className="text-right py-1">{isFa ? "جمع" : "Total"}</th>
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
          <p>{isFa ? "جمع جزء:" : "Subtotal:"} {fmtMoney(invoice.subtotal)}</p>
          <p>{isFa ? "مالیات:" : "Tax:"} {fmtMoney(invoice.taxTotal)}</p>
          {invoice.discount > 0 && <p>{isFa ? "تخفیف:" : "Discount:"} -{fmtMoney(invoice.discount)}</p>}
          <p className="font-bold text-base">{isFa ? "جمع کل:" : "Total:"} {fmtMoney(invoice.total)} {invoice.currency}</p>
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

function ContractsPanel({ isFa, contacts }: { isFa: boolean; contacts: Contact[] }) {
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
    if (!contactId || !title.trim()) { setError(isFa ? "مشتری و عنوان الزامی است" : "Contact and title are required"); return; }
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
      setError(err instanceof Error ? err.message : "خطا");
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
          {isFa ? "بازیابی قالب‌های پیش‌فرض" : "Restore default templates"}
        </button>
        <button onClick={() => setShowTemplates((v) => !v)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium" style={{ background: "var(--surface-2)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
          <FileSignature className="w-4 h-4" /> {isFa ? "مدیریت قالب‌ها" : "Manage Templates"}
        </button>
        <button onClick={() => setShowNew((v) => !v)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: "var(--primary)" }}>
          <Plus className="w-4 h-4" /> {isFa ? "قرارداد جدید" : "New Contract"}
        </button>
      </div>

      {showNew && (
        <div className="rounded-2xl p-4 space-y-2" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <p className="text-[11px] p-2 rounded-lg" style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>
            {isFa
              ? "این قالب صرفاً یک نقطه شروع است و توصیه یا مشاوره حقوقی محسوب نمی‌شود. لطفاً پیش از استفاده، نسخه‌ی نهایی را با یک وکیل یا مشاور حقوقی متخصص بازبینی کنید."
              : "This template is a starting point only and does not constitute legal advice. Please have your customized version reviewed by a qualified lawyer before use."}
          </p>
          <select value={contactId} onChange={(e) => setContactId(e.target.value)}
            className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
            <option value="">{isFa ? "انتخاب مشتری..." : "Select contact..."}</option>
            {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={isFa ? "عنوان قرارداد" : "Contract title"}
            className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}
            className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
            <option value="">{isFa ? "بدون قالب (متن آزاد)" : "No template (free text)"}</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          {!templateId && (
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={5} placeholder={isFa ? "متن قرارداد..." : "Contract text..."}
              className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          )}
          {error && <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>}
          <button onClick={createContract} disabled={saving} className="w-full py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--primary)" }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : (isFa ? "ساخت قرارداد" : "Create Contract")}
          </button>
        </div>
      )}

      {showTemplates && (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          {templates.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: "var(--text-muted)" }}>{isFa ? "هنوز قالبی ثبت نشده" : "No templates yet"}</p>
          ) : (
            templates.map((t, i) => (
              <div key={t.id} className="flex items-center justify-between px-4 py-3" style={{ background: "var(--surface-1)", borderTop: i > 0 ? "1px solid var(--border)" : undefined }}>
                <p className="text-sm" style={{ color: "var(--text-primary)" }}>{t.name}</p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setEditingTemplate(t)} className="text-[11px] px-2 py-1 rounded-lg" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>{isFa ? "ویرایش" : "Edit"}</button>
                  <button onClick={() => deleteTemplate(t.id)}><Trash2 className="w-4 h-4" style={{ color: "#ef4444" }} /></button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {contracts.length === 0 ? (
        <p className="text-sm text-center py-12" style={{ color: "var(--text-muted)" }}>{isFa ? "هنوز قراردادی ثبت نشده" : "No contracts yet"}</p>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          {contracts.map((c, i) => {
            const st = CONTRACT_STATUS_LABEL[c.status] || CONTRACT_STATUS_LABEL.draft;
            return (
              <div key={c.id} className="flex items-center justify-between px-4 py-3 flex-wrap gap-2" style={{ background: "var(--surface-1)", borderTop: i > 0 ? "1px solid var(--border)" : undefined }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{c.title} — {c.contact.name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-medium" style={{ background: "var(--surface-2)", color: st.color }}>{isFa ? st.fa : st.en}</span>
                  {c.status === "draft" && <button onClick={() => setStatus(c.id, "sent")} className="text-[11px] px-2 py-1 rounded-lg" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>{isFa ? "ارسال" : "Send"}</button>}
                  {c.status !== "signed" && c.status !== "cancelled" && <button onClick={() => setStatus(c.id, "signed")} className="text-[11px] px-2 py-1 rounded-lg" style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e" }}>{isFa ? "امضا شد" : "Mark Signed"}</button>}
                  <button onClick={() => setEditingContract(c)} className="text-[11px] px-2 py-1 rounded-lg" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>{isFa ? "ویرایش" : "Edit"}</button>
                  <button onClick={() => setPrintContract(c)}><Printer className="w-4 h-4" style={{ color: "var(--text-secondary)" }} /></button>
                  <button onClick={() => deleteContract(c.id)}><Trash2 className="w-4 h-4" style={{ color: "#ef4444" }} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {printContract && <ContractPrintModal isFa={isFa} contract={printContract} onClose={() => setPrintContract(null)} />}
      {editingContract && (
        <ContractEditModal isFa={isFa} contract={editingContract} onClose={() => setEditingContract(null)} onSave={saveEditedContract} />
      )}
      {editingTemplate && (
        <TemplateEditModal isFa={isFa} template={editingTemplate} onClose={() => setEditingTemplate(null)} onSave={saveTemplateEdit} />
      )}
    </div>
  );
}

function ContractPrintModal({ isFa, contract, onClose }: { isFa: boolean; contract: CrmContractRow; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:p-0 print:static" style={{ background: "rgba(0,0,0,0.6)" }}>
      <div className="print:hidden absolute top-4 left-4 flex gap-2">
        <button onClick={() => window.print()} className="px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: "var(--primary)" }}>{isFa ? "چاپ / PDF" : "Print / PDF"}</button>
        <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium" style={{ background: "var(--surface-2)", color: "var(--text-primary)" }}>{isFa ? "بستن" : "Close"}</button>
      </div>
      <div dir={isFa ? "rtl" : "ltr"} className="w-full max-w-xl rounded-2xl p-8 space-y-4 max-h-[85vh] overflow-y-auto print:max-h-none print:overflow-visible print:shadow-none print:rounded-none whitespace-pre-wrap"
        style={{ background: "#fff", color: "#111" }}>
        <h2 className="text-lg font-bold">{contract.title}</h2>
        <p className="text-xs">{isFa ? "مشتری:" : "Contact:"} {contract.contact.name}</p>
        <div className="text-sm leading-7">{contract.content}</div>
      </div>
    </div>
  );
}

function ContractEditModal({ isFa, contract, onClose, onSave }: { isFa: boolean; contract: CrmContractRow; onClose: () => void; onSave: (content: string) => void }) {
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
        <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{isFa ? "ویرایش قرارداد" : "Edit Contract"}</h2>
        <button onClick={onClose}><X className="w-5 h-5" style={{ color: "var(--text-muted)" }} /></button>
      </div>
      {contract.status !== "draft" && (
        <p className="text-[11px] p-2 rounded-lg mb-2" style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>
          {isFa
            ? "این قرارداد نهایی‌شده — نسخه‌ی فعلی پیش از ذخیره تغییرات، آرشیو می‌شود."
            : "This contract is finalized — the current version will be archived before your changes are saved."}
        </p>
      )}
      <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={12}
        className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
      <button onClick={handleSave} disabled={saving} className="w-full mt-3 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--primary)" }}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : (isFa ? "ذخیره تغییرات" : "Save Changes")}
      </button>
    </Modal>
  );
}

function TemplateEditModal({ isFa, template, onClose, onSave }: { isFa: boolean; template: CrmContractTemplateRow; onClose: () => void; onSave: (name: string, content: string) => void }) {
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
        <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{isFa ? "ویرایش قالب قرارداد" : "Edit Contract Template"}</h2>
        <button onClick={onClose}><X className="w-5 h-5" style={{ color: "var(--text-muted)" }} /></button>
      </div>
      <p className="text-[11px] p-2 rounded-lg mb-2" style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>
        {isFa
          ? "این قالب صرفاً یک نقطه شروع است و توصیه یا مشاوره حقوقی محسوب نمی‌شود. متن را با توجه به سیاست‌های کسب‌وکار خود ویرایش کنید."
          : "This template is a starting point only and does not constitute legal advice. Edit the text to match your own business policy."}
      </p>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder={isFa ? "نام قالب" : "Template name"}
        className="w-full px-3 py-2 rounded-xl text-sm outline-none mb-2" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
      <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={12}
        className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
      <button onClick={handleSave} disabled={saving} className="w-full mt-3 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--primary)" }}>
        {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : (isFa ? "ذخیره تغییرات" : "Save Changes")}
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
function ProjectsPanel({ isFa, contacts }: { isFa: boolean; contacts: Contact[] }) {
  const [projects, setProjects] = useState<CrmProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

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
    if (!name.trim()) { setError(isFa ? "نام پروژه الزامی است" : "Project name is required"); return; }
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
      setError(err instanceof Error ? err.message : "خطا");
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
          <Plus className="w-4 h-4" /> {isFa ? "پروژه جدید" : "New Project"}
        </button>
      </div>

      {showNew && (
        <div className="rounded-2xl p-4 space-y-2" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={isFa ? "نام پروژه" : "Project name"}
            className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <select value={contactId} onChange={(e) => setContactId(e.target.value)}
            className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
            <option value="">{isFa ? "بدون مخاطب (اختیاری)" : "No contact (optional)"}</option>
            {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder={isFa ? "توضیحات (اختیاری)" : "Description (optional)"}
            className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          {error && <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>}
          <button onClick={createProject} disabled={saving} className="w-full py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--primary)" }}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : (isFa ? "ساخت پروژه" : "Create Project")}
          </button>
        </div>
      )}

      {projects.length === 0 ? (
        <p className="text-sm text-center py-12" style={{ color: "var(--text-muted)" }}>{isFa ? "هنوز پروژه‌ای ثبت نشده" : "No projects yet"}</p>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          {projects.map((p, i) => {
            const st = PROJECT_STATUS_LABEL[p.status] || PROJECT_STATUS_LABEL.active;
            return (
              <div key={p.id} className="flex items-center justify-between px-4 py-3 flex-wrap gap-2" style={{ background: "var(--surface-1)", borderTop: i > 0 ? "1px solid var(--border)" : undefined }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{p.name} {p.contact ? `— ${p.contact.name}` : ""}</p>
                  {p.description && <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{p.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <select value={p.status} onChange={(e) => setStatus(p.id, e.target.value)}
                    className="text-[10px] px-2 py-1 rounded-full font-medium outline-none" style={{ background: "var(--surface-2)", color: st.color, border: "none" }}>
                    {Object.entries(PROJECT_STATUS_LABEL).map(([val, l]) => <option key={val} value={val}>{isFa ? l.fa : l.en}</option>)}
                  </select>
                  <button onClick={() => deleteProject(p.id)}><Trash2 className="w-4 h-4" style={{ color: "#ef4444" }} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
