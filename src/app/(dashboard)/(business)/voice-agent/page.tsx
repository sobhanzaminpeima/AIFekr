"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Phone, Plus, X, Loader2, PhoneCall, CalendarDays, Settings2,
  Trash2, PlayCircle, Home, MapPin, Clock, XCircle, User, BookOpen, Upload, Share2,
} from "lucide-react";
import toast from "react-hot-toast";
import { useTranslation, tri, type Lang } from "@/lib/i18n";

interface VoiceAgent {
  id: string; name: string; focus: string; vertical: string; businessType?: string | null; systemPrompt: string; voiceId: string | null;
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
  { value: "general", fa: "عمومی", en: "General", de: "Allgemein" },
  { value: "buy", fa: "خرید", en: "Buy", de: "Kauf" },
  { value: "sell", fa: "فروش", en: "Sell", de: "Verkauf" },
  { value: "rent", fa: "اجاره", en: "Rent", de: "Miete" },
];

const VERTICAL_OPTIONS = [
  { value: "real_estate", fa: "املاک", en: "Real Estate", de: "Immobilien" },
  { value: "general", fa: "سایر کسب‌وکارها", en: "Any Business (General)", de: "Jedes Geschäft (Allgemein)" },
];

const APPOINTMENT_STATUSES = ["pending", "confirmed", "completed", "cancelled", "no_show"];

function fmtMoney(n: number) {
  return new Intl.NumberFormat("fa-IR").format(n);
}

export default function VoiceAgentPage() {
  const { lang, t } = useTranslation();
  const isFa = lang === "fa";

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
  // Section 2, item 4 — the real-estate vertical (property search/viewing
  // tools) must only be offered when the customer's industry pack includes
  // it; a non-real-estate customer still gets the (unrelated) generic
  // voice agent, just without this vertical option — same access system as
  // every other real-estate module, not a one-off check.
  const [realEstateVerticalEnabled, setRealEstateVerticalEnabled] = useState(false);

  useEffect(() => {
    fetch("/api/crm/module-access?keys=agent.voiceCallCenter")
      .then((r) => r.json())
      .then((d) => setRealEstateVerticalEnabled(!!d.access?.["agent.voiceCallCenter"]))
      .catch(() => setRealEstateVerticalEnabled(false));
  }, []);

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
      setError(tri(lang, "اتصال به سرور برقرار نشد. اتصال اینترنت یا در دسترس بودن سرور را بررسی کنید.", "Could not reach the server. Check your connection or try again shortly.", "Server nicht erreichbar. Überprüfen Sie Ihre Verbindung oder versuchen Sie es später erneut."));
      setUpgrading(false);
      return;
    }
    try {
      const data = await res.json();
      if (!res.ok || !data.paymentUrl) throw new Error(data.error || tri(lang, "خطا در شروع پرداخت", "Failed to start payment", "Fehler beim Starten der Zahlung"));
      window.location.href = data.paymentUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : tri(lang, "خطا در پرداخت", "Payment error", "Zahlungsfehler"));
      setUpgrading(false);
    }
  }

  async function createAgent(form: { name: string; focus: string; vertical: string; businessType?: string }) {
    setError("");
    const res = await fetch("/api/voice-agent/agents", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || tri(lang, "خطا", "Error", "Fehler")); return; }
    setShowNewAgent(false);
    loadAgents();
  }

  async function deleteAgent(id: string) {
    if (!confirm(tri(lang, "این ایجنت حذف شود؟", "Delete this agent?", "Diesen Agenten löschen?"))) return;
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
      if (!res.ok) throw new Error(data.error || tri(lang, "خطا در اتصال به Vapi", "Failed to connect to Vapi", "Verbindung zu Vapi fehlgeschlagen"));
      loadAgents();
    } catch (e) {
      setError(e instanceof Error ? e.message : tri(lang, "خطا", "Error", "Fehler"));
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
    if (!res.ok) { setError(data.error || tri(lang, "خطا", "Error", "Fehler")); return; }
    setShowNewProperty(false);
    loadProperties();
    if (data.matchedLeads?.length) {
      const names = data.matchedLeads.map((l: { contactName: string }) => l.contactName).join("، ");
      toast.success(tri(lang,
        `${data.matchedLeads.length} لید قدیمی با پروفایل مشابه پیدا شد — پیشنهاد می‌شود اطلاع‌رسانی کنید: ${names}`,
        `Found ${data.matchedLeads.length} past lead(s) with a matching profile — consider notifying them: ${names}`,
        `${data.matchedLeads.length} frühere(r) Lead(s) mit passendem Profil gefunden — Benachrichtigung empfohlen: ${names}`
      ), { duration: 8000 });
    }
  }

  async function deleteProperty(id: string) {
    if (!confirm(tri(lang, "این ملک حذف شود؟", "Delete this property?", "Diese Immobilie löschen?"))) return;
    await fetch(`/api/voice-agent/properties/${id}`, { method: "DELETE" });
    loadProperties();
  }

  async function createKnowledge(form: { title: string; content: string; agentId?: string }) {
    setError("");
    const res = await fetch("/api/voice-agent/knowledge", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || tri(lang, "خطا", "Error", "Fehler")); return; }
    loadKnowledge();
  }

  async function deleteKnowledge(id: string) {
    if (!confirm(tri(lang, "این مورد حذف شود؟", "Delete this entry?", "Diesen Eintrag löschen?"))) return;
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

  // Properties are a real-estate-only concept — hide that tab when the user
  // has no real-estate-vertical agent (defaults to shown before any agent
  // exists, since we can't yet know which vertical they'll pick).
  const showPropertiesTab = agents.length === 0 || agents.some((a) => a.vertical !== "general");

  return (
    <div dir={isFa ? "rtl" : "ltr"} className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(245,158,11,0.15)" }}>
          <Phone className="w-5 h-5" style={{ color: "#f59e0b" }} />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{tri(lang, "مرکز تماس هوش مصنوعی", "AI Call Center", "KI-Callcenter")}</h1>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{tri(lang, "پاسخگویی تلفنی هوشمند برای هر کسب‌وکار — از املاک تا هر صنعت دیگر", "AI phone agents for any business — real estate and beyond", "KI-Telefonagenten für jedes Unternehmen — Immobilien und darüber hinaus")}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-6 px-6 sm:mx-0 sm:px-0" style={{ scrollbarWidth: "thin" }}>
        {[
          { id: "agents" as const, label: tri(lang, "ایجنت‌ها", "Agents", "Agenten"), icon: Settings2 },
          ...(showPropertiesTab ? [{ id: "properties" as const, label: tri(lang, "ملک‌ها", "Properties", "Immobilien"), icon: Home }] : []),
          { id: "knowledge" as const, label: tri(lang, "دانش‌نامه", "Knowledge Base", "Wissensdatenbank"), icon: BookOpen },
          { id: "calls" as const, label: tri(lang, "تماس‌ها", "Calls", "Anrufe"), icon: PhoneCall },
          { id: "appointments" as const, label: tri(lang, "رزروها", "Appointments", "Termine"), icon: CalendarDays },
        ].map((tb) => (
          <button key={tb.id} onClick={() => setTab(tb.id)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all flex-shrink-0"
            style={{ background: tab === tb.id ? "#f59e0b" : "var(--surface-1)", color: tab === tb.id ? "white" : "var(--text-secondary)", border: "1px solid var(--border)" }}>
            <tb.icon className="w-4 h-4" /> {tb.label}
          </button>
        ))}
      </div>

      {voicePlan === "NONE" && (
        <div className="rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)" }}>
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              {tri(lang, "اتصال شماره تلفن واقعی و تماس نامحدود بخشی از افزونه Voice Agent است", "Real phone numbers and unlimited calling are part of the Voice Agent add-on", "Echte Telefonnummern und unbegrenzte Anrufe sind Teil des Voice-Agent-Add-ons")}
            </p>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {tri(lang, "می‌توانید ۱ ایجنت رایگان بسازید و تنظیمات را آماده کنید؛ برای شماره تلفن واقعی ارتقا دهید.", "You can create 1 free agent and configure it; upgrade to connect a real phone number.", "Sie können 1 kostenlosen Agenten erstellen und konfigurieren; upgraden Sie für eine echte Telefonnummer.")}
            </p>
          </div>
          <button onClick={purchaseVoicePlan} disabled={upgrading}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ background: "#f59e0b" }}>
            {upgrading ? <Loader2 className="w-4 h-4 animate-spin" /> : tri(lang, "فعال‌سازی Voice Agent", "Activate Voice Agent", "Voice Agent aktivieren")}
          </button>
        </div>
      )}

      {error && <p className="text-sm" style={{ color: "#ef4444" }}>{error}</p>}

      {tab === "agents" && (
        <AgentsTab
          isFa={isFa} lang={lang} agents={agents} showNewAgent={showNewAgent} setShowNewAgent={setShowNewAgent}
          onCreate={createAgent} onDelete={deleteAgent} onToggleActive={toggleAgentActive}
          onProvision={provisionAgent} provisioningId={provisioningId}
          realEstateVerticalEnabled={realEstateVerticalEnabled}
        />
      )}
      {tab === "properties" && (
        <PropertiesTab
          isFa={isFa} lang={lang} properties={properties} showNew={showNewProperty} setShowNew={setShowNewProperty}
          onCreate={createProperty} onDelete={deleteProperty}
        />
      )}
      {tab === "knowledge" && (
        <KnowledgeTab isFa={isFa} lang={lang} t={t} agents={agents} entries={knowledgeEntries} onCreate={createKnowledge} onDelete={deleteKnowledge} onUploaded={loadKnowledge} />
      )}
      {tab === "calls" && (
        <CallsTab isFa={isFa} lang={lang} calls={calls} expandedCallId={expandedCallId} setExpandedCallId={setExpandedCallId} />
      )}
      {tab === "appointments" && (
        <AppointmentsTab isFa={isFa} lang={lang} appointments={appointments} onUpdateStatus={updateAppointmentStatus} />
      )}
    </div>
  );
}

function AgentsTab({
  isFa, lang, agents, showNewAgent, setShowNewAgent, onCreate, onDelete, onToggleActive, onProvision, provisioningId, realEstateVerticalEnabled,
}: {
  isFa: boolean; lang: Lang; agents: VoiceAgent[]; showNewAgent: boolean; setShowNewAgent: (v: boolean) => void;
  onCreate: (f: { name: string; focus: string; vertical: string; businessType?: string }) => void; onDelete: (id: string) => void;
  onToggleActive: (a: VoiceAgent) => void; onProvision: (id: string) => void; provisioningId: string | null;
  realEstateVerticalEnabled: boolean;
}) {
  const [name, setName] = useState("");
  const [focus, setFocus] = useState("general");
  const [vertical, setVertical] = useState("general");
  const [businessType, setBusinessType] = useState("");
  const verticalOptions = realEstateVerticalEnabled ? VERTICAL_OPTIONS : VERTICAL_OPTIONS.filter((v) => v.value === "general");

  // Module access resolves asynchronously after mount — once it does, default
  // a still-untouched form to real_estate (nicer for the common case: a
  // real-estate customer's very first agent) without fighting a user who
  // already picked something.
  const touchedVertical = useRef(false);
  useEffect(() => {
    if (!touchedVertical.current && realEstateVerticalEnabled) setVertical("real_estate");
  }, [realEstateVerticalEnabled]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowNewAgent(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: "#f59e0b" }}>
          <Plus className="w-4 h-4" /> {tri(lang, "ایجنت جدید", "New Agent", "Neuer Agent")}
        </button>
      </div>

      {agents.length === 0 && (
        <div className="text-center py-16 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <Phone className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{tri(lang, "هنوز ایجنتی نساخته‌اید", "You haven't created an agent yet", "Sie haben noch keinen Agenten erstellt")}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {agents.map((a) => (
          <div key={a.id} className="p-5 rounded-2xl space-y-3" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{a.name}</p>
                <p className="text-xs mt-0.5 flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
                  <span>{a.vertical === "general" && a.businessType ? a.businessType : (VERTICAL_OPTIONS.find((v) => v.value === a.vertical)?.[isFa ? "fa" : lang === "de" ? "de" : "en"] || a.vertical)}</span>
                  {a.vertical !== "general" && (
                    <>
                      <span>·</span>
                      <span>{FOCUS_OPTIONS.find((f) => f.value === a.focus)?.[isFa ? "fa" : lang === "de" ? "de" : "en"]}</span>
                    </>
                  )}
                </p>
              </div>
              <button onClick={() => onToggleActive(a)}
                className="text-xs px-2 py-1 rounded-lg"
                style={{ background: a.isActive ? "rgba(245,158,11,0.15)" : "rgba(148,163,184,0.15)", color: a.isActive ? "#f59e0b" : "var(--text-muted)" }}>
                {a.isActive ? tri(lang, "فعال", "Active", "Aktiv") : tri(lang, "غیرفعال", "Inactive", "Inaktiv")}
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
              {a.phoneNumber ? (
                <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {a.phoneNumber}</span>
              ) : (
                <span className="flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                  <XCircle className="w-3.5 h-3.5" /> {tri(lang, "بدون شماره تلفن", "No phone number yet", "Noch keine Telefonnummer")}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-muted)" }}>
              <span>{tri(lang, `${a._count?.calls ?? 0} تماس`, `${a._count?.calls ?? 0} calls`, `${a._count?.calls ?? 0} Anrufe`)}</span>
              <span>{tri(lang, `${a._count?.appointments ?? 0} رزرو`, `${a._count?.appointments ?? 0} bookings`, `${a._count?.appointments ?? 0} Buchungen`)}</span>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button onClick={() => onProvision(a.id)} disabled={provisioningId === a.id}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium disabled:opacity-50"
                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                {provisioningId === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlayCircle className="w-3.5 h-3.5" />}
                {a.vapiAssistantId ? tri(lang, "همگام‌سازی با Vapi", "Sync to Vapi", "Mit Vapi synchronisieren") : tri(lang, "اتصال شماره تلفن", "Connect phone number", "Telefonnummer verbinden")}
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
              <p className="font-semibold" style={{ color: "var(--text-primary)" }}>{tri(lang, "ایجنت صوتی جدید", "New Voice Agent", "Neuer Sprachagent")}</p>
              <button onClick={() => setShowNewAgent(false)}><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{tri(lang, "نام", "Name", "Name")}</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder={tri(lang, "مثلاً خط فروش", "e.g. Sales Line", "z.B. Verkaufslinie")}
                className="w-full px-3 py-2 rounded-xl text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{tri(lang, "نوع کسب‌وکار", "Business Type", "Geschäftstyp")}</label>
              <select value={vertical} onChange={(e) => { touchedVertical.current = true; setVertical(e.target.value); }}
                className="w-full px-3 py-2 rounded-xl text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                {verticalOptions.map((v) => <option key={v.value} value={v.value}>{tri(lang, v.fa, v.en, v.de)}</option>)}
              </select>
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                {vertical === "general"
                  ? tri(lang, "برای هر کسب‌وکاری مناسب است — از دانش‌نامه و رزرو وقت عمومی استفاده می‌کند.", "Works for any business — uses the knowledge base and generic appointment booking.", "Für jedes Geschäft — nutzt die Wissensdatenbank und allgemeine Terminbuchung.")
                  : tri(lang, "برای آژانس‌های املاک — شامل جستجوی ملک و رزرو بازدید.", "For real-estate agencies — includes property search and viewing bookings.", "Für Immobilienagenturen — umfasst Immobiliensuche und Besichtigungsbuchungen.")}
              </p>
            </div>
            {vertical !== "general" && (
              <div className="space-y-1">
                <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{tri(lang, "تمرکز", "Focus", "Fokus")}</label>
                <select value={focus} onChange={(e) => setFocus(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                  {FOCUS_OPTIONS.map((f) => <option key={f.value} value={f.value}>{tri(lang, f.fa, f.en, f.de)}</option>)}
                </select>
              </div>
            )}
            {vertical === "general" && (
              <div className="space-y-1">
                <label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{tri(lang, "نوع دقیق کسب‌وکار", "Business Type", "Geschäftstyp")}</label>
                <input value={businessType} onChange={(e) => setBusinessType(e.target.value)}
                  placeholder={tri(lang, "مثلاً «کلینیک دندانپزشکی»، «دفتر وکالت»، «فروشگاه لوازم الکترونیکی»", "e.g. \"Dental clinic\", \"Law firm\", \"Online electronics store\"", "z.B. \"Zahnarztpraxis\", \"Anwaltskanzlei\", \"Online-Elektronikgeschäft\"")}
                  className="w-full px-3 py-2 rounded-xl text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
              </div>
            )}
            <button onClick={() => onCreate({ name, focus, vertical, businessType: vertical === "general" ? businessType : undefined })} disabled={!name.trim()}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ background: "#f59e0b" }}>
              {tri(lang, "ساخت ایجنت", "Create Agent", "Agent erstellen")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function KnowledgeTab({
  isFa, lang, t, agents, entries, onCreate, onDelete, onUploaded,
}: {
  isFa: boolean; lang: Lang; t: ReturnType<typeof useTranslation>["t"]; agents: VoiceAgent[]; entries: VoiceKnowledgeEntry[];
  onCreate: (f: { title: string; content: string; agentId?: string }) => void; onDelete: (id: string) => void;
  onUploaded: () => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [agentId, setAgentId] = useState("");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadAgentId, setUploadAgentId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const up = t.voiceAgentUpload;

  function submit() {
    onCreate({ title, content, agentId: agentId || undefined });
    setTitle(""); setContent(""); setAgentId("");
  }

  async function handleFile(file: File) {
    const isPdf = file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf";
    const isDocx = file.name.toLowerCase().endsWith(".docx") || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (!isPdf && !isDocx) { toast.error(up.unsupportedType); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error(up.fileTooLarge); return; }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (uploadTitle.trim()) fd.append("title", uploadTitle.trim());
      if (uploadAgentId) fd.append("agentId", uploadAgentId);
      const res = await fetch("/api/voice-agent/knowledge/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || up.parseFailed);
      toast.success(up.uploadSuccess);
      setUploadTitle(""); setUploadAgentId("");
      onUploaded();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : up.parseFailed);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-4">
      <div className="p-5 rounded-2xl space-y-3" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{up.title}</p>
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>{up.description}</p>

        <input value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} placeholder={up.titleLabel}
          className="w-full px-3 py-2 rounded-xl text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
        <select value={uploadAgentId} onChange={(e) => setUploadAgentId(e.target.value)}
          className="w-full px-3 py-2 rounded-xl text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
          <option value="">{tri(lang, "همه ایجنت‌ها", "All agents", "Alle Agenten")}</option>
          {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault(); setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) handleFile(f);
          }}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className="flex flex-col items-center justify-center gap-2 py-8 rounded-xl cursor-pointer text-center transition-colors"
          style={{ border: `2px dashed ${dragOver ? "#f59e0b" : "var(--border)"}`, background: dragOver ? "rgba(245,158,11,0.06)" : "var(--surface-2)" }}
        >
          {uploading ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#f59e0b" }} />
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{up.uploading}</p>
            </>
          ) : (
            <>
              <Upload className="w-6 h-6" style={{ color: "var(--text-muted)" }} />
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{up.dropText}</p>
            </>
          )}
          <input ref={fileInputRef} type="file" accept=".pdf,.docx" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </div>

        <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
          <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
          {up.or}
          <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
        </div>

        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tri(lang, "عنوان (مثلاً «ساعات کاری»)", "Title (e.g. Office hours)", "Titel (z.B. Bürozeiten)")}
          className="w-full px-3 py-2 rounded-xl text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
        <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={3} placeholder={tri(lang, "پاسخ کامل...", "Full answer...", "Vollständige Antwort...")}
          className="w-full px-3 py-2 rounded-xl text-sm resize-none" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
        <select value={agentId} onChange={(e) => setAgentId(e.target.value)}
          className="w-full px-3 py-2 rounded-xl text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
          <option value="">{tri(lang, "همه ایجنت‌ها", "All agents", "Alle Agenten")}</option>
          {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <button onClick={submit} disabled={!title.trim() || !content.trim()}
          className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ background: "#f59e0b" }}>
          {tri(lang, "افزودن", "Add", "Hinzufügen")}
        </button>
      </div>

      {entries.length === 0 && (
        <div className="text-center py-10 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <BookOpen className="w-8 h-8 mx-auto mb-2" style={{ color: "var(--text-muted)" }} />
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{tri(lang, "دانش‌نامه هنوز خالی است", "Knowledge base is empty", "Wissensdatenbank ist leer")}</p>
        </div>
      )}

      <div className="space-y-2">
        {entries.map((e) => (
          <div key={e.id} className="p-4 rounded-2xl flex items-start justify-between gap-3" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{e.title}</p>
              <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>{e.content}</p>
              <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
                {e.agentId ? (agents.find((a) => a.id === e.agentId)?.name || "") : tri(lang, "همه ایجنت‌ها", "All agents", "Alle Agenten")}
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
  isFa, lang, properties, showNew, setShowNew, onCreate, onDelete,
}: {
  isFa: boolean; lang: Lang; properties: VoiceProperty[]; showNew: boolean; setShowNew: (v: boolean) => void;
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
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: "#f59e0b" }}>
          <Plus className="w-4 h-4" /> {tri(lang, "ملک جدید", "New Property", "Neue Immobilie")}
        </button>
      </div>

      {properties.length === 0 && (
        <div className="text-center py-16 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <Home className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{tri(lang, "هنوز ملکی ثبت نکرده‌اید", "No properties yet", "Noch keine Immobilien")}</p>
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
            <p className="text-sm font-semibold" style={{ color: "#f59e0b" }}>{fmtMoney(p.price)} {tri(lang, "تومان", "IRT", "IRR")}</p>
            <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
              <span className="px-2 py-0.5 rounded-full" style={{ background: "var(--surface-2)" }}>{p.listingType}</span>
              <span className="px-2 py-0.5 rounded-full" style={{ background: "var(--surface-2)" }}>{p.status}</span>
              {p.bedrooms != null && <span>{p.bedrooms} {tri(lang, "خواب", "bed", "Zi.")}</span>}
              {p.areaSqm != null && <span>{p.areaSqm} m²</span>}
            </div>
            {/* Was a tiny unlabeled icon — the user reported not being able to
                find the share link at all. Now a full-width labeled button
                showing the actual path, plus a direct "open" action. */}
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/p/${p.id}`);
                  toast.success(tri(lang, "لینک اشتراک‌گذاری کپی شد", "Share link copied", "Link kopiert"));
                }}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: "var(--surface-2)", color: "var(--text-primary)" }}
              >
                <Share2 className="w-3.5 h-3.5" />
                {tri(lang, "کپی لینک اشتراک‌گذاری", "Copy share link", "Link kopieren")}
                <span dir="ltr" className="opacity-60">/p/{p.id.slice(0, 8)}…</span>
              </button>
              <a
                href={`/p/${p.id}`}
                target="_blank"
                rel="noreferrer"
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
                title={tri(lang, "مشاهدهٔ صفحهٔ عمومی", "Open public page", "Öffentliche Seite öffnen")}
              >
                {tri(lang, "مشاهده", "Open", "Öffnen")}
              </a>
            </div>
          </div>
        ))}
      </div>

      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }} onClick={() => setShowNew(false)}>
          <div className="w-full max-w-md p-6 rounded-2xl space-y-3 max-h-[90vh] overflow-y-auto" style={{ background: "var(--surface-0)", border: "1px solid var(--border)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="font-semibold" style={{ color: "var(--text-primary)" }}>{tri(lang, "ملک جدید", "New Property", "Neue Immobilie")}</p>
              <button onClick={() => setShowNew(false)}><X className="w-4 h-4" /></button>
            </div>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={tri(lang, "عنوان", "Title", "Titel")}
              className="w-full px-3 py-2 rounded-xl text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            <div className="grid grid-cols-2 gap-2">
              <select value={form.listingType} onChange={(e) => setForm({ ...form, listingType: e.target.value })}
                className="px-3 py-2 rounded-xl text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                <option value="sell">{tri(lang, "فروش", "Sell", "Verkauf")}</option>
                <option value="buy">{tri(lang, "خرید", "Buy", "Kauf")}</option>
                <option value="rent">{tri(lang, "اجاره", "Rent", "Miete")}</option>
              </select>
              <input value={form.propertyType} onChange={(e) => setForm({ ...form, propertyType: e.target.value })} placeholder={tri(lang, "نوع ملک", "Property type", "Immobilientyp")}
                className="px-3 py-2 rounded-xl text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            </div>
            <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder={tri(lang, "آدرس", "Address", "Adresse")}
              className="w-full px-3 py-2 rounded-xl text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            <div className="grid grid-cols-2 gap-2">
              <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder={tri(lang, "شهر", "City", "Stadt")}
                className="px-3 py-2 rounded-xl text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
              <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder={tri(lang, "قیمت (تومان)", "Price", "Preis")} type="number"
                className="px-3 py-2 rounded-xl text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input value={form.bedrooms} onChange={(e) => setForm({ ...form, bedrooms: e.target.value })} placeholder={tri(lang, "تعداد خواب", "Bedrooms", "Schlafzimmer")} type="number"
                className="px-3 py-2 rounded-xl text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
              <input value={form.areaSqm} onChange={(e) => setForm({ ...form, areaSqm: e.target.value })} placeholder={tri(lang, "متراژ", "Area (m²)", "Fläche (m²)")} type="number"
                className="px-3 py-2 rounded-xl text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            </div>
            <button onClick={submit} disabled={!form.title.trim() || !form.address.trim() || !form.price}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50" style={{ background: "#f59e0b" }}>
              {tri(lang, "ثبت ملک", "Save Property", "Immobilie speichern")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CallsTab({ isFa, lang, calls, expandedCallId, setExpandedCallId }: {
  isFa: boolean; lang: Lang; calls: VoiceCall[]; expandedCallId: string | null; setExpandedCallId: (id: string | null) => void;
}) {
  if (calls.length === 0) {
    return (
      <div className="text-center py-16 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <PhoneCall className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{tri(lang, "هنوز تماسی ثبت نشده است", "No calls yet", "Noch keine Anrufe")}</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {calls.map((c) => (
        <div key={c.id} className="rounded-2xl overflow-hidden" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <button onClick={() => setExpandedCallId(expandedCallId === c.id ? null : c.id)} className="w-full p-4 flex items-center justify-between text-left">
            <div className="flex items-center gap-3">
              <PhoneCall className="w-4 h-4" style={{ color: "#f59e0b" }} />
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{c.callerPhone || tri(lang, "شماره ناشناس", "Unknown number", "Unbekannte Nummer")}</p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>{c.agent?.name} · {new Date(c.createdAt).toLocaleString(tri(lang, "fa-IR", "en-US", "de-DE"))}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
              {c.durationSec != null && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {c.durationSec}s</span>}
              <span className="px-2 py-0.5 rounded-full" style={{ background: "var(--surface-2)" }}>{c.status}</span>
            </div>
          </button>
          {expandedCallId === c.id && (
            <div className="px-4 pb-4 space-y-2 text-sm" style={{ color: "var(--text-secondary)" }}>
              {c.summary && <p><strong>{tri(lang, "خلاصه: ", "Summary: ", "Zusammenfassung: ")}</strong>{c.summary}</p>}
              {c.outcome && <p><strong>{tri(lang, "نتیجه: ", "Outcome: ", "Ergebnis: ")}</strong>{c.outcome}</p>}
              {c.transcript && <pre className="whitespace-pre-wrap text-xs p-3 rounded-xl" style={{ background: "var(--surface-2)" }}>{c.transcript}</pre>}
              {!c.summary && !c.transcript && <p style={{ color: "var(--text-muted)" }}>{tri(lang, "جزئیاتی موجود نیست", "No details available", "Keine Details verfügbar")}</p>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function AppointmentsTab({ isFa, lang, appointments, onUpdateStatus }: {
  isFa: boolean; lang: Lang; appointments: VoiceAppointment[]; onUpdateStatus: (id: string, status: string) => void;
}) {
  if (appointments.length === 0) {
    return (
      <div className="text-center py-16 rounded-2xl" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <CalendarDays className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--text-muted)" }} />
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{tri(lang, "هنوز رزروی ثبت نشده است", "No appointments yet", "Noch keine Termine")}</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {appointments.map((a) => (
        <div key={a.id} className="p-4 rounded-2xl flex items-center justify-between flex-wrap gap-3" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-3">
            <User className="w-4 h-4" style={{ color: "#f59e0b" }} />
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{a.leadName || tri(lang, "بدون نام", "No name", "Kein Name")} · {a.leadPhone}</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {new Date(a.scheduledAt).toLocaleString(tri(lang, "fa-IR", "en-US", "de-DE"))}
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
