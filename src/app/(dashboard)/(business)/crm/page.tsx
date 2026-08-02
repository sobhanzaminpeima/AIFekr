"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Briefcase, Plus, X, Phone, Mail, Building2, Loader2, ChevronDown,
  Users, LayoutGrid, Clock, CheckCircle2, Circle,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";

interface Stage { id: string; name: string; order: number; isWon: boolean; isLost: boolean; }
interface Pipeline { id: string; name: string; industrySlug: string | null; isDefault: boolean; stages: Stage[]; }
interface DealContact { id: string; name: string; phone: string | null; company: string | null; }
interface Deal {
  id: string; title: string; value: number; stageId: string; pipelineId: string;
  status: string; contactId: string; contact: DealContact; expectedCloseDate: string | null;
}
interface Contact {
  id: string; name: string; phone: string | null; email: string | null; company: string | null;
  status: string; totalSpent: number; lastContact: string | null;
}
interface Activity { id: string; type: string; content: string; createdAt: string; }
interface Task { id: string; title: string; status: string; dueDate: string | null; }
interface ContactDetail extends Contact {
  deals: Deal[]; activities: Activity[]; tasks: Task[];
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

export default function CrmPage() {
  const { lang } = useTranslation();
  const isFa = lang !== "en";

  const [tab, setTab] = useState<"board" | "contacts">("board");
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

  useEffect(() => { loadPipelines(); }, [loadPipelines]);
  useEffect(() => { if (selectedPipelineId) loadDeals(selectedPipelineId); }, [selectedPipelineId, loadDeals]);
  useEffect(() => { if (tab === "contacts") loadContacts(); }, [tab, loadContacts]);

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
          ].map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all"
              style={{ background: tab === t.id ? "var(--primary)" : "var(--surface-1)", color: tab === t.id ? "white" : "var(--text-secondary)", border: "1px solid var(--border)" }}>
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm" style={{ color: "#ef4444" }}>{error}</p>}

      {pipelines.length === 0 ? (
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
      ) : (
        <div className="space-y-3">
          <div className="flex justify-end">
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
          onClose={() => setSelectedDealId(null)}
          onChanged={() => { if (selectedPipelineId) loadDeals(selectedPipelineId); }}
        />
      )}

      {/* Contact detail panel */}
      {selectedContactId && contactDetail && (
        <ContactDetailModal
          isFa={isFa}
          contact={contactDetail}
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

function NewContactModal({ isFa, onClose, onCreated }: { isFa: boolean; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
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
        body: JSON.stringify({ name: name.trim(), phone: phone || undefined, email: email || undefined, company: company || undefined }),
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
        {error && <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>}
        <button onClick={submit} disabled={saving} className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ background: "var(--primary)" }}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : (isFa ? "ساخت مخاطب" : "Create Contact")}
        </button>
      </div>
    </Modal>
  );
}

function DealDetailModal({ isFa, dealId, onClose, onChanged }: { isFa: boolean; dealId: string; onClose: () => void; onChanged: () => void }) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

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

  async function deleteDeal() {
    await fetch(`/api/crm/deals/${dealId}`, { method: "DELETE" });
    onChanged();
    onClose();
  }

  return (
    <Modal onClose={onClose}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{isFa ? "جزئیات معامله" : "Deal Detail"}</h2>
        <button onClick={onClose}><X className="w-5 h-5" style={{ color: "var(--text-muted)" }} /></button>
      </div>
      <div className="space-y-3">
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

function ContactDetailModal({ isFa, contact, onClose, onChanged }: { isFa: boolean; contact: ContactDetail; onClose: () => void; onChanged: () => void }) {
  const [note, setNote] = useState("");
  const [taskTitle, setTaskTitle] = useState("");

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
    </Modal>
  );
}
