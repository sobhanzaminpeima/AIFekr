"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Phone, Plus, X, Loader2, PhoneCall, CalendarDays, Settings2,
  Trash2, PlayCircle, Home, MapPin, Clock, XCircle, User, BookOpen,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";

interface VoiceAgent {
  id: string; name: string; focus: string; systemPrompt: string; voiceId: string | null;
  phoneNumber: string | null; vapiAssistantId: string | null; isActive: boolean;
  _count?: { calls: number; appointments: number };
}
interface VoiceProperty {
  id: string; title: string; listingType: string; propertyType: string; price: number;
  address: string; city: string | null; bedrooms: number | null; bathrooms: number | null;
  areaSqm: number | null; status: string;
}
interface VoiceCall {
  id: string; callerPhone: string | null; direction: string; status: string; outcome: string | null;
  summary: string | null; transcript: string | null; durationSec: number | null; createdAt: string;
  agent?: { name: string };
}
interface VoiceAppointment {
  id: string; leadName: string | null; leadPhone: string | null; scheduledAt: string; status: string; notes: string | null;
  agent?: { name: string }; property?: { title: string; address: string } | null;
}
interface VoiceKnowledgeEntry {
  id: string; title: string; content: string; agentId: string | null;
}

const FOCUS_OPTIONS = [
  { value: "general", fa: "عمومی", en: "General" },
  { value: "buy", fa: "خرید", en: "Buy" },
  { value: "sell", fa: "فروش", en: "Sell" },
  { value: "rent", fa: "اجاره", en: "Rent" },
];

const APPOINTMENT_STATUSES = ["pending", "confirmed", "completed", "cancelled", "no_show"];

function fmtMoney(n: number) {
  return new Intl.NumberFormat("fa-IR").format(n);
}

export default function VoiceAgentPage() {
  const { lang } = useTranslation();
  const isFa = lang !== "en";

  const [tab, setTab] = useState<"agents" | "properties" | "knowledge" | "calls" | "appointments">("agents");
  const [loading, setLoading] = useState(true);
  const [voicePlan, setVoicePlan] = useState<string>("NONE");
  const [upgrading, setUpgrading] = useState(false);
  const [error, setError] = useState("");

  const [agents, setAgents] = useState<VoiceAgent[]>([]);
  const [properties, setProperties] = useState<VoiceProperty[]>([]);
  const [calls, setCalls] = useState<VoiceCall[]>([]);
  const [appointments, setAppointments] = useState<VoiceAppointment[]>([]);
  const [knowledgeEntries, setKnowledgeEntries] = useState<VoiceKnowledgeEntry[]>([]);

  const [showNewAgent, setShowNewAgent] = useState(false);
  const [showNewProperty, setShowNewProperty] = useState(false);
  const [provisioningId, setProvisioningId] = useState<string | null>(null);
  const [expandedCallId, setExpandedCallId] = useState<string | null>(null);

  const loadAgents = useCallback(async () => {
    const res = await fetch("/api/voice-agent/agents");
    const data = await res.json();
    setAgents(data.agents || []);
    setVoicePlan(data.voicePlan || "NONE");
    setLoading(false);
  }, []);
  const loadProperties = useCallback(async () => {
    const res = await fetch("/api/voice-agent/properties");
    const data = await res.json();
    setProperties(data.properties || []);
  }, []);
  const loadCalls = useCallback(async () => {
    const res = await fetch("/api/voice-agent/calls");
    const data = await res.json();
    setCalls(data.calls || []);
  }, []);
  const loadAppointments = useCallback(async () => {
    const res = await fetch("/api/voice-agent/appointments");
    const data = await res.json();
    setAppointments(data.appointments || []);
  }, []);
  const loadKnowledge = useCallback(async () => {
    const res = await fetch("/api/voice-agent/knowledge");
    const data = await res.json();
    setKnowledgeEntries(data.entries || []);
  }, []);

  useEffect(() => { loadAgents(); }, [loadAgents]);
  useEffect(() => { if (tab === "knowledge") loadKnowledge(); }, [tab, loadKnowledge]);
  useEffect(() => { if (tab === "properties") loadProperties(); }, [tab, loadProperties]);
  useEffect(() => { if (tab === "calls") loadCalls(); }, [tab, loadCalls]);
  useEffect(() => { if (tab === "appointments") loadAppointments(); }, [tab, loadAppointments]);

  async function purchaseVoicePlan() {
    setUpgrading(true);
    setError("");
    let res: Response;
    try {
      res = await fetch("/api/payment/create", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: "VOICE_MONTHLY" }),
      });
    } catch {
      // fetch() itself throwing (not an HTTP error status) means the request
      // never reached a server — server down, wrong origin, offline, or a
      // browser extension/CORS block. A raw "Failed to fetch" here is
      // meaningless to a user, so translate it to an actionable message.
      setError(isFa ? "اتصال به سرور برقرار نشد. اتصال اینترنت یا در دسترس بودن سرور را بررسی کنید." : "Could not reach the server. Check your connection or try again shortly.");
      setUpgrading(false);
      return;
    }
    try {
      const data = await res.json();
      if (!res.ok || !data.paymentUrl) throw new Error(data.error || (isFa ? "خطا در شروع پرداخت" : "Failed to start payment"));
      window.location.href = data.paymentUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : (isFa ? "خطا در پرداخت" : "Payment error"));
      setUpgrading(false);
    }
  }

  async function createAgent(form: { name: string; focus: string }) {
    setError("");
    const res = await fetch("/api/voice-agent/agents", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || (isFa ? "خطا" : "Error")); return; }
    setShowNewAgent(false);
    loadAgents();
  }

  async function deleteAgent(id: string) {
    if (!confirm(isFa ? "این ایجنت حذف شود؟" : "Delete this agent?")) return;
    await fetch(`/api/voice-agent/agents/${id}`, { method: "DELETE" });
    loadAgents();
  }

  async function toggleAgentActive(agent: VoiceAgent) {
    await fetch(`/api/voice-agent/agents/${agent.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !agent.isActive }),
    });
    loadAgents();
  }

  async function provisionAgent(id: string) {
    setProvisioningId(id);
    setError("");
    try {
      const res = await fetch(`/api/voice-agent/agents/${id}/provision`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || (isFa ? "خطا در اتصال به Vapi" : "Failed to connect to Vapi"));
      loadAgents();
    } catch (e) {
      setError(e instanceof Error ? e.message : (isFa ? "خطا" : "Error"));
    } finally {
      setProvisioningId(null);
    }
  }

  async function createProperty(form: Record<string, unknown>) {
    setError("");
    const res = await fetch("/api/voice-agent/properties", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || (isFa ? "خطا" : "Error")); return; }
    setShowNewProperty(false);
    loadProperties();
  }

  async function deleteProperty(id: string) {
    if (!confirm(isFa ? "این ملک حذف شود؟" : "Delete this property?")) return;
    await fetch(`/api/voice-agent/properties/${id}`, { method: "DELETE" });
    loadProperties();
  }

  async function createKnowledge(form: { title: string; content: string; agentId?: string }) {
    setError("");
    const res = await fetch("/api/voice-agent/knowledge", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || (isFa ? "خطا" : "Error")); return; }
    loadKnowledge();
  }

  async function deleteKnowledge(id: string) {
    if (!confirm(isFa ? "این مورد حذف شود؟" : "Delete this entry?")) return;
    await fetch(`/api/voice-agent/knowledge/${id}`, { method: "DELETE" });
    loadKnowledge();
  }

  async function updateAppointmentStatus(id: string, status: string) {
    setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
    await fetch(`/api/voice-agent/appointments/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
    }).catch(() => loadAppointments());
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
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(22,163,74,0.15)" }}>
          <Phone className="w-5 h-5" style={{ color: "#16a34a" }} />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{isFa ? "ایجنت صوتی املاک" : "Voice Agent"}</h1>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{isFa ? "پاسخگویی تلفنی هوشمند برای خرید، فروش و اجاره ملک" : "AI phone agents for property buy, sell & rent inquiries"}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-6 px-6 sm:mx-0 sm:px-0" style={{ scrollbarWidth: "thin" }}>
        {[
          { id: "agents" as const, label: isFa ? "ایجنت‌ها" : "Agents", icon: Settings2 },
          { id: "properties" as const, label: isFa ? "ملک‌ها" : "Properties", icon: Home },
          { id: "knowledge" as const, label: isFa ? "دانش‌نامه" : "Knowledge Base", icon: BookOpen },
          { id: "calls" as const, label: isFa ? "تماس‌ها" : "Calls", icon: PhoneCall },
          { id: "appointments" as const, label: isFa ? "رزروها" : "Appointments", icon: CalendarDays },
        ].map((tb) => (
          <button key={tb.id} onClick={() => setTab(tb.id)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all flex-shrink-0"
            style={{ background: tab === tb.id ? "#16a34a" : "var(--surface-1)", color: tab === tb.id ? "white" : "var(--text-secondary)", border: "1px solid var(--border)" }}>
            <tb.icon className="w-4 h-4" /> {tb.label}
          </button>
        ))}
      </div>

      {voicePlan === "NONE" && (
        <div className="rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3" style={{ background: "rgba(22,163,74,0.08)", border: "1px solid rgba(22,163,74,0.3)" }}>
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              {isFa ? "اتصال شماره تلفن واقعی و تماس نامحدود بخشی از افزونه Voice Agent است" : "Real phone numbers and unlimited calling are part of the Voice Agent add-on"}
            </p>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {isFa ? "می‌توانید ۱ ایجنت رایگان بسازید و تنظیمات را آماده کنید؛ برای شماره تلفن واقعی ارتقا دهید." : "You can create 1 free agent and configure it; upgrade to connect a real phone number."}
            </p>
          </div>
          <button onClick={purchaseVoicePlan} disabled={upgrading}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ background: "#16a34a" }}>
            {upgrading ? <Loader2 className="w-4 h-4 animate-spin" /> : (isFa ? "فعال‌سازی Voice Agent" : "Activate Voice Agent")}
          </button>
        </div>
      )}

      {error && <p className="text-sm" style={{ color: "#ef4444" }}>{error}</p>}

      {tab === "agents" && (
        <AgentsTab
          isFa={isFa} agents={agents} showNewAgent={showNewAgent} setShowNewAgent={setShowNewAgent}
          onCreate={createAgent} onDelete={deleteAgent} onToggleActive={toggleAgentActive}
          onProvision={provisionAgent} provisioningId={provisioningId}
        />
      )}
      {tab === "properties" && (
        <PropertiesTab
          isFa={isFa} properties={properties} showNew={showNewProperty} setShowNew={setShowNewProperty}
          onCreate={createProperty} onDelete={deleteProperty}
        />
      )}
      {tab === "knowledge" && (
        <KnowledgeTab isFa={isFa} agents={agents} entries={knowledgeEntries} onCreate={createKnowledge} onDelete={deleteKnowledge} />
      )}
      {tab === "calls" && (
        <CallsTab isFa={isFa} calls={calls} expandedCallId={expandedCallId} setExpandedCallId={setExpandedCallId} />
      )}
      {tab === "appointments" && (
        <AppointmentsTab isFa={isFa} appointments={appointments} onUpdateStatus={updateAppointmentStatus} />
      )}
    </div>
  );
}

function AgentsTab({
  isFa, agents, showNewAgent, setShowNewAgent, onCreate, onDelete, onToggleActive, onProvision, provisioningId,
}: {
  isFa: boolean; agents: VoiceAgent[]; showNewAgent: boolean; setShowNewAgent: (v: boolean) => void;
  onCreate: (f: { name: string; focus: string }) => void; onDelete: (id: string) => void;
  onToggleActive: (a: VoiceAgent) => void; onProvision: (id: string) => void; provisioningId: string | null;
}) {
  const [name, setName] = useState("");
  const [focus, setFocus] = useState("general");

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowNewAgent(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: "#16a34a" }}>
          <Plus className="w-4 h-4" /> {isFa ? "ایجنت جدید" : "New Agent"}
        </button>
      </div>

      {agents.length === 0 && (
        <div className="text-center py-16 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <Phone className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{isFa ? "هنوز ایجنتی نساخته‌اید" : "You haven't created an agent yet"}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {agents.map((a) => (
          <div key={a.id} className="p-5 rounded-2xl space-y-3" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{a.name}</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {FOCUS_OPTIONS.find((f) => f.value === a.focus)?.[isFa ? "fa" : "en"]}
                </p>
              </div>
              <button onClick={() => onToggleActive(a)}
                className="text-xs px-2 py-1 rounded-lg"
                style={{ background: a.isActive ? "rgba(22,163,74,0.15)" : "rgba(148,163,184,0.15)", color: a.isActive ? "#16a34a" : "var(--text-muted)" }}>
                {a.isActive ? (isFa ? "فعال" : "Active") : (isFa ? "غیرفعال" : "Inactive")}
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
              {a.phoneNumber ? (
                <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {a.phoneNumber}</span>
              ) : (
                <span className="flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                  <XCircle className="w-3.5 h-3.5" /> {isFa ? "بدون شماره تلفن" : "No phone number yet"}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-muted)" }}>
              <span>{isFa ? `${a._count?.calls ?? 0} تماس` : `${a._count?.calls ?? 0} calls`}</span>
              <span>{isFa ? `${a._count?.appointments ?? 0} رزرو` : `${a._count?.appointments ?? 0} bookings`}</span>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button onClick={() => onProvision(a.id)} disabled={provisioningId === a.id}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium disabled:opacity-50"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                {provisioningId === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlayCircle className="w-3.5 h-3.5" />}
                {a.vapiAssistantId ? (isFa ? "همگام‌سازی با Vapi" : "Sync to Vapi") : (isFa ? "اتصال شماره تلفن" : "Connect phone number")}
              </button>
              <button onClick={() => onDelete(a.id)} className="p-2 rounded-xl" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                <Trash2 className="w-3.5 h-3.5" style={{ color: "#ef4444" }} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {showNewAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => setShowNewAgent(false)}>
          <div className="w-full max-w-md p-6 rounded-2xl space-y-4" style={{ background: "var(--surface-0)", border: "1px solid var(--border)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="font-semibold" style={{ color: "var(--text-primary)" }}>{isFa ? "ایجنت صوتی جدید" : "New Voice Agent"}</p>
              <button onClick={() => setShowNewAgent(false)}><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{isFa ? "نام" : "Name"}</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder={isFa ? "مثلاً خط فروش" : "e.g. Sales Line"}
                className="w-full px-3 py-2 rounded-xl text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{isFa ? "تمرکز" : "Focus"}</label>
              <select value={focus} onChange={(e) => setFocus(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                {FOCUS_OPTIONS.map((f) => <option key={f.value} value={f.value}>{isFa ? f.fa : f.en}</option>)}
              </select>
            </div>
            <button onClick={() => onCreate({ name, focus })} disabled={!name.trim()}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ background: "#16a34a" }}>
              {isFa ? "ساخت ایجنت" : "Create Agent"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function KnowledgeTab({
  isFa, agents, entries, onCreate, onDelete,
}: {
  isFa: boolean; agents: VoiceAgent[]; entries: VoiceKnowledgeEntry[];
  onCreate: (f: { title: string; content: string; agentId?: string }) => void; onDelete: (id: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [agentId, setAgentId] = useState("");

  function submit() {
    onCreate({ title, content, agentId: agentId || undefined });
    setTitle(""); setContent(""); setAgentId("");
  }

  return (
    <div className="space-y-4">
      <div className="p-5 rounded-2xl space-y-3" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {isFa ? "افزودن به دانش‌نامه" : "Add Knowledge Entry"}
        </p>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
          {isFa ? "ایجنت هنگام تماس برای سوالاتی که مربوط به ملک خاصی نیست (ساعات کاری، مدارک، شرایط پرداخت و...) از این موارد استفاده می‌کند." : "The agent draws on these mid-call for questions that aren't about a specific property (hours, required documents, payment terms, etc.)."}
        </p>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={isFa ? "عنوان (مثلاً «ساعات کاری»)" : "Title (e.g. \"Office hours\")"}
          className="w-full px-3 py-2 rounded-xl text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
        <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={3} placeholder={isFa ? "پاسخ کامل..." : "Full answer..."}
          className="w-full px-3 py-2 rounded-xl text-sm resize-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
        <select value={agentId} onChange={(e) => setAgentId(e.target.value)}
          className="w-full px-3 py-2 rounded-xl text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
          <option value="">{isFa ? "همه ایجنت‌ها" : "All agents"}</option>
          {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <button onClick={submit} disabled={!title.trim() || !content.trim()}
          className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ background: "#16a34a" }}>
          {isFa ? "افزودن" : "Add"}
        </button>
      </div>

      {entries.length === 0 && (
        <div className="text-center py-10 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <BookOpen className="w-8 h-8 mx-auto mb-2" style={{ color: "var(--text-muted)" }} />
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{isFa ? "دانش‌نامه هنوز خالی است" : "Knowledge base is empty"}</p>
        </div>
      )}

      <div className="space-y-2">
        {entries.map((e) => (
          <div key={e.id} className="p-4 rounded-2xl flex items-start justify-between gap-3" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{e.title}</p>
              <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>{e.content}</p>
              <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
                {e.agentId ? (agents.find((a) => a.id === e.agentId)?.name || "") : (isFa ? "همه ایجنت‌ها" : "All agents")}
              </p>
            </div>
            <button onClick={() => onDelete(e.id)}><Trash2 className="w-3.5 h-3.5" style={{ color: "#ef4444" }} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

function PropertiesTab({
  isFa, properties, showNew, setShowNew, onCreate, onDelete,
}: {
  isFa: boolean; properties: VoiceProperty[]; showNew: boolean; setShowNew: (v: boolean) => void;
  onCreate: (f: Record<string, unknown>) => void; onDelete: (id: string) => void;
}) {
  const [form, setForm] = useState({ title: "", listingType: "sell", propertyType: "apartment", price: "", address: "", city: "", bedrooms: "", areaSqm: "" });

  function submit() {
    onCreate({
      title: form.title, listingType: form.listingType, propertyType: form.propertyType,
      price: Number(form.price), address: form.address, city: form.city || undefined,
      bedrooms: form.bedrooms ? Number(form.bedrooms) : undefined, areaSqm: form.areaSqm ? Number(form.areaSqm) : undefined,
    });
    setForm({ title: "", listingType: "sell", propertyType: "apartment", price: "", address: "", city: "", bedrooms: "", areaSqm: "" });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: "#16a34a" }}>
          <Plus className="w-4 h-4" /> {isFa ? "ملک جدید" : "New Property"}
        </button>
      </div>

      {properties.length === 0 && (
        <div className="text-center py-16 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <Home className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{isFa ? "هنوز ملکی ثبت نکرده‌اید" : "No properties yet"}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {properties.map((p) => (
          <div key={p.id} className="p-5 rounded-2xl space-y-2" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <div className="flex items-start justify-between">
              <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{p.title}</p>
              <button onClick={() => onDelete(p.id)}><Trash2 className="w-3.5 h-3.5" style={{ color: "#ef4444" }} /></button>
            </div>
            <p className="text-xs flex items-center gap-1" style={{ color: "var(--text-secondary)" }}><MapPin className="w-3.5 h-3.5" /> {p.address}{p.city ? `، ${p.city}` : ""}</p>
            <p className="text-sm font-semibold" style={{ color: "#16a34a" }}>{fmtMoney(p.price)} {isFa ? "تومان" : "IRT"}</p>
            <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
              <span className="px-2 py-0.5 rounded-full" style={{ background: "var(--surface-2)" }}>{p.listingType}</span>
              <span className="px-2 py-0.5 rounded-full" style={{ background: "var(--surface-2)" }}>{p.status}</span>
              {p.bedrooms != null && <span>{p.bedrooms} {isFa ? "خواب" : "bed"}</span>}
              {p.areaSqm != null && <span>{p.areaSqm} m²</span>}
            </div>
          </div>
        ))}
      </div>

      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => setShowNew(false)}>
          <div className="w-full max-w-md p-6 rounded-2xl space-y-3 max-h-[90vh] overflow-y-auto" style={{ background: "var(--surface-0)", border: "1px solid var(--border)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="font-semibold" style={{ color: "var(--text-primary)" }}>{isFa ? "ملک جدید" : "New Property"}</p>
              <button onClick={() => setShowNew(false)}><X className="w-4 h-4" /></button>
            </div>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={isFa ? "عنوان" : "Title"}
              className="w-full px-3 py-2 rounded-xl text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            <div className="grid grid-cols-2 gap-2">
              <select value={form.listingType} onChange={(e) => setForm({ ...form, listingType: e.target.value })}
                className="px-3 py-2 rounded-xl text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                <option value="sell">{isFa ? "فروش" : "Sell"}</option>
                <option value="buy">{isFa ? "خرید" : "Buy"}</option>
                <option value="rent">{isFa ? "اجاره" : "Rent"}</option>
              </select>
              <input value={form.propertyType} onChange={(e) => setForm({ ...form, propertyType: e.target.value })} placeholder={isFa ? "نوع ملک" : "Property type"}
                className="px-3 py-2 rounded-xl text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            </div>
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder={isFa ? "آدرس" : "Address"}
              className="w-full px-3 py-2 rounded-xl text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            <div className="grid grid-cols-2 gap-2">
              <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder={isFa ? "شهر" : "City"}
                className="px-3 py-2 rounded-xl text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
              <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder={isFa ? "قیمت (تومان)" : "Price"} type="number"
                className="px-3 py-2 rounded-xl text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input value={form.bedrooms} onChange={(e) => setForm({ ...form, bedrooms: e.target.value })} placeholder={isFa ? "تعداد خواب" : "Bedrooms"} type="number"
                className="px-3 py-2 rounded-xl text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
              <input value={form.areaSqm} onChange={(e) => setForm({ ...form, areaSqm: e.target.value })} placeholder={isFa ? "متراژ" : "Area (m²)"} type="number"
                className="px-3 py-2 rounded-xl text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            </div>
            <button onClick={submit} disabled={!form.title.trim() || !form.address.trim() || !form.price}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ background: "#16a34a" }}>
              {isFa ? "ثبت ملک" : "Save Property"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CallsTab({ isFa, calls, expandedCallId, setExpandedCallId }: {
  isFa: boolean; calls: VoiceCall[]; expandedCallId: string | null; setExpandedCallId: (id: string | null) => void;
}) {
  if (calls.length === 0) {
    return (
      <div className="text-center py-16 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <PhoneCall className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{isFa ? "هنوز تماسی ثبت نشده است" : "No calls yet"}</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {calls.map((c) => (
        <div key={c.id} className="rounded-2xl overflow-hidden" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <button onClick={() => setExpandedCallId(expandedCallId === c.id ? null : c.id)} className="w-full p-4 flex items-center justify-between text-left">
            <div className="flex items-center gap-3">
              <PhoneCall className="w-4 h-4" style={{ color: "#16a34a" }} />
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{c.callerPhone || (isFa ? "شماره ناشناس" : "Unknown number")}</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{c.agent?.name} · {new Date(c.createdAt).toLocaleString(isFa ? "fa-IR" : "en-US")}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
              {c.durationSec != null && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {c.durationSec}s</span>}
              <span className="px-2 py-0.5 rounded-full" style={{ background: "var(--surface-2)" }}>{c.status}</span>
            </div>
          </button>
          {expandedCallId === c.id && (
            <div className="px-4 pb-4 space-y-2 text-sm" style={{ color: "var(--text-secondary)" }}>
              {c.summary && <p><strong>{isFa ? "خلاصه: " : "Summary: "}</strong>{c.summary}</p>}
              {c.outcome && <p><strong>{isFa ? "نتیجه: " : "Outcome: "}</strong>{c.outcome}</p>}
              {c.transcript && <pre className="whitespace-pre-wrap text-xs p-3 rounded-xl" style={{ background: "var(--surface-2)" }}>{c.transcript}</pre>}
              {!c.summary && !c.transcript && <p style={{ color: "var(--text-muted)" }}>{isFa ? "جزئیاتی موجود نیست" : "No details available"}</p>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function AppointmentsTab({ isFa, appointments, onUpdateStatus }: {
  isFa: boolean; appointments: VoiceAppointment[]; onUpdateStatus: (id: string, status: string) => void;
}) {
  if (appointments.length === 0) {
    return (
      <div className="text-center py-16 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <CalendarDays className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{isFa ? "هنوز رزروی ثبت نشده است" : "No appointments yet"}</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {appointments.map((a) => (
        <div key={a.id} className="p-4 rounded-2xl flex items-center justify-between flex-wrap gap-3" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-3">
            <User className="w-4 h-4" style={{ color: "#16a34a" }} />
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{a.leadName || (isFa ? "بدون نام" : "No name")} · {a.leadPhone}</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {new Date(a.scheduledAt).toLocaleString(isFa ? "fa-IR" : "en-US")}
                {a.property && ` · ${a.property.title}`}
              </p>
            </div>
          </div>
          <select value={a.status} onChange={(e) => onUpdateStatus(a.id, e.target.value)}
            className="px-3 py-1.5 rounded-xl text-xs" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
            {APPOINTMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      ))}
    </div>
  );
}
