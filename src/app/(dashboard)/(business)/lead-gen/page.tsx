"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  Magnet, Plus, Copy, ExternalLink, Trash2, Pencil, X, Loader2, Code2,
  BarChart3, Users, Flame, ChevronDown, HelpCircle,
} from "lucide-react";
import { useTranslation, tri } from "@/lib/i18n";
import { LEAD_FIELD_KEYS, FIELD_LABELS, type LeadFieldsConfig, type LeadFieldKey } from "@/lib/leadgen/fields";
import { downscaleImage } from "@/lib/image/downscaleImage";

interface LeadFormRow {
  id: string;
  slug: string;
  title: string;
  titleEn: string | null;
  titleDe: string | null;
  description: string | null;
  descriptionEn: string | null;
  descriptionDe: string | null;
  fields: LeadFieldsConfig;
  accentColor: string;
  logoUrl: string | null;
  submitLabel: string | null;
  successMessage: string | null;
  redirectUrl: string | null;
  isActive: boolean;
  submissionCount: number;
  createdAt: string;
}

interface Submission {
  id: string;
  contactId: string | null;
  data: Record<string, string>;
  score: number;
  utmSource: string | null;
  utmCampaign: string | null;
  createdAt: string;
}

interface Report {
  channels: { source: string; total: number; qualified: number; customer: number; conversionRate: number }[];
  totalLeads: number;
  formLeads: number;
  formSubmissions: number;
  avgScore: number;
}

const SOURCE_LABELS: Record<string, { fa: string; en: string; de: string }> = {
  lead_form: { fa: "فرم لید", en: "Lead form", de: "Lead-Formular" },
  property_link: { fa: "لینک ملک", en: "Property link", de: "Immobilienlink" },
  organic: { fa: "ارگانیک", en: "Organic", de: "Organisch" },
  referral: { fa: "معرفی", en: "Referral", de: "Empfehlung" },
  manual: { fa: "دستی", en: "Manual", de: "Manuell" },
  instagram: { fa: "اینستاگرام", en: "Instagram", de: "Instagram" },
  meta_lead_ads: { fa: "Meta Lead Ads", en: "Meta Lead Ads", de: "Meta Lead Ads" },
  google_ads: { fa: "Google Ads", en: "Google Ads", de: "Google Ads" },
};

// When App Review for leads_retrieval isn't approved yet, tenants file a
// request an admin fulfils by hand instead of running the OAuth dialog.
const SELF_SERVE_META = process.env.NEXT_PUBLIC_META_LEADS_SELF_SERVE === "1";

interface Connector {
  id: string;
  provider: string;
  name: string;
  status: string;
  lastError: string | null;
  lastLeadAt: string | null;
  leadsImported: number;
  webhookUrl: string | null;
  webhookKey: string | null;
}

export default function LeadGenPage() {
  const { lang } = useTranslation();

  const [plan, setPlan] = useState<string | null>(null);
  const [planLoaded, setPlanLoaded] = useState(false);
  const [forms, setForms] = useState<LeadFormRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<Report | null>(null);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [requestingMeta, setRequestingMeta] = useState(false);
  const [editing, setEditing] = useState<LeadFormRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [openSubs, setOpenSubs] = useState<string | null>(null);
  const [subs, setSubs] = useState<Record<string, Submission[]>>({});

  const appOrigin = typeof window !== "undefined" ? window.location.origin : "";
  const isPaid = plan !== null && plan !== "FREE";

  useEffect(() => {
    fetch("/api/user/profile")
      .then((r) => r.json())
      .then((d) => setPlan(d?.user?.plan ?? "FREE"))
      .catch(() => setPlan("FREE"))
      .finally(() => setPlanLoaded(true));
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/leadgen/forms").then((r) => (r.ok ? r.json() : { forms: [] })),
      fetch("/api/leadgen/report").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/leadgen/connectors").then((r) => (r.ok ? r.json() : { connectors: [] })),
    ])
      .then(([f, rep, con]) => {
        setForms(f.forms || []);
        setReport(rep);
        setConnectors(con.connectors || []);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (isPaid) load();
  }, [isPaid, load]);

  // Toast after returning from the Meta OAuth dialog.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search);
    const m = q.get("meta");
    if (m === "connected") toast.success(tri(lang, `Meta وصل شد (${q.get("pages") || 0} پیج)`, `Meta connected (${q.get("pages") || 0} pages)`, `Meta verbunden (${q.get("pages") || 0} Seiten)`));
    else if (m === "failed") toast.error(tri(lang, "اتصال Meta ناموفق بود", "Meta connection failed", "Meta-Verbindung fehlgeschlagen"));
    else if (m === "nopages") toast.error(tri(lang, "هیچ پیجی برای این حساب یافت نشد", "No Pages found for this account", "Keine Seiten für dieses Konto gefunden"));
    if (m) window.history.replaceState(null, "", "/lead-gen");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createForm() {
    setCreating(true);
    try {
      const res = await fetch("/api/leadgen/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: tri(lang, "فرم لید جدید", "New lead form", "Neues Lead-Formular") }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      load();
      // open the editor on the new form once the list reloads
      setTimeout(() => {
        fetch("/api/leadgen/forms")
          .then((r) => r.json())
          .then((f) => {
            const fresh = (f.forms || []).find((x: LeadFormRow) => x.id === data.id);
            if (fresh) setEditing(fresh);
          });
      }, 300);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tri(lang, "خطا", "Error", "Fehler"));
    } finally {
      setCreating(false);
    }
  }

  async function saveForm(f: LeadFormRow) {
    const res = await fetch(`/api/leadgen/forms/${f.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(f),
    });
    if (res.ok) {
      toast.success(tri(lang, "ذخیره شد", "Saved", "Gespeichert"));
      setEditing(null);
      load();
    } else {
      toast.error(tri(lang, "ذخیره نشد", "Save failed", "Speichern fehlgeschlagen"));
    }
  }

  async function requestMeta() {
    const pageName = window.prompt(tri(lang, "نام پیج فیسبوک/اینستاگرام که می‌خواهید وصل شود:", "Name of the Facebook/Instagram Page to connect:", "Name der Facebook/Instagram-Seite, die verbunden werden soll:"));
    if (pageName === null) return;
    setRequestingMeta(true);
    try {
      const res = await fetch("/api/leadgen/connectors/meta/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageName }),
      });
      if (!res.ok) throw new Error();
      toast.success(tri(lang, "درخواست ثبت شد — تیم ما به‌زودی وصل می‌کند", "Request submitted — our team will connect it shortly", "Anfrage gesendet — unser Team verbindet es in Kürze"));
      load();
    } catch {
      toast.error(tri(lang, "خطا", "Error", "Fehler"));
    } finally {
      setRequestingMeta(false);
    }
  }

  async function connectGoogle() {
    setConnectingGoogle(true);
    try {
      const res = await fetch("/api/leadgen/connectors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "google" }),
      });
      if (!res.ok) throw new Error();
      toast.success(tri(lang, "کانکتور Google ساخته شد", "Google connector created", "Google-Connector erstellt"));
      load();
    } catch {
      toast.error(tri(lang, "خطا", "Error", "Fehler"));
    } finally {
      setConnectingGoogle(false);
    }
  }

  async function disconnectConnector(id: string) {
    if (!confirm(tri(lang, "این اتصال حذف شود؟", "Remove this connection?", "Diese Verbindung entfernen?"))) return;
    await fetch(`/api/leadgen/connectors/${id}`, { method: "DELETE" });
    load();
  }

  async function toggleActive(f: LeadFormRow) {
    await fetch(`/api/leadgen/forms/${f.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !f.isActive }),
    });
    load();
  }

  async function deleteForm(f: LeadFormRow) {
    if (!confirm(tri(lang, "این فرم حذف شود؟ لیدهای ثبت‌شده در CRM باقی می‌مانند.", "Delete this form? Leads already in the CRM stay.", "Dieses Formular löschen? Bereits erfasste Leads bleiben im CRM."))) return;
    await fetch(`/api/leadgen/forms/${f.id}`, { method: "DELETE" });
    load();
  }

  async function loadSubs(formId: string) {
    if (openSubs === formId) {
      setOpenSubs(null);
      return;
    }
    setOpenSubs(formId);
    if (!subs[formId]) {
      const res = await fetch(`/api/leadgen/forms/${formId}/submissions`);
      const data = await res.json();
      setSubs((s) => ({ ...s, [formId]: data.submissions || [] }));
    }
  }

  function copy(text: string, msg: string) {
    navigator.clipboard.writeText(text);
    toast.success(msg);
  }

  const sourceLabel = (s: string) =>
    (SOURCE_LABELS[s] ? SOURCE_LABELS[s][lang === "tr" ? "en" : lang] : null) || s;

  if (!planLoaded) {
    return <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  if (!isPaid) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6" dir={lang === "fa" ? "rtl" : "ltr"}>
        <div className="max-w-md text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto" style={{ background: "linear-gradient(135deg,#ea580c,#f97316)" }}>
            <Magnet className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
            {tri(lang, "ماژول تولید لید", "Lead Generation module", "Lead-Generierungs-Modul")}
          </h1>
          <p style={{ color: "var(--text-secondary)" }}>
            {tri(lang,
              "با پلن پولی، فرم‌های لید بسازید، روی سایت خودتان امبد کنید و همه‌ی لیدها مستقیم وارد CRM شما شوند.",
              "On a paid plan, build lead forms, embed them on your own site, and have every lead flow straight into your CRM.",
              "Mit einem kostenpflichtigen Plan erstellen Sie Lead-Formulare, binden sie auf Ihrer Website ein und alle Leads landen direkt in Ihrem CRM.")}
          </p>
          <Link href="/plans" className="inline-block px-6 py-3 rounded-xl font-bold text-white" style={{ background: "linear-gradient(135deg,#ea580c,#f97316)" }}>
            {tri(lang, "مشاهده پلن‌ها", "See plans", "Pläne ansehen")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto" dir={lang === "fa" ? "rtl" : "ltr"}>
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <Magnet className="w-6 h-6" style={{ color: "#ea580c" }} />
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
            {tri(lang, "تولید لید", "Lead Generation", "Lead-Generierung")}
          </h1>
        </div>
        <button onClick={createForm} disabled={creating}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-semibold text-white text-sm"
          style={{ background: "linear-gradient(135deg,#ea580c,#f97316)" }}>
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          {tri(lang, "فرم جدید", "New form", "Neues Formular")}
        </button>
      </div>

      {/* guide */}
      <div className="rounded-xl mb-5 overflow-hidden" style={{ background: "rgba(234,88,12,0.06)", border: "1px solid rgba(234,88,12,0.25)" }}>
        <button onClick={() => setGuideOpen((o) => !o)} className="w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold" style={{ color: "#ea580c" }}>
          <HelpCircle className="w-4 h-4" />
          {tri(lang, "راهنما: چطور از این ماژول استفاده کنم؟", "Guide: how to use this module", "Anleitung: So nutzen Sie dieses Modul")}
          <ChevronDown className={`w-4 h-4 ms-auto transition-transform ${guideOpen ? "rotate-180" : ""}`} />
        </button>
        {guideOpen && (
          <div className="px-4 pb-4 text-sm leading-7" style={{ color: "var(--text-secondary)" }}>
            <ol className="list-decimal ps-5 space-y-1.5">
              <li>{tri(lang,
                "روی «فرم جدید» بزنید تا یک فرم لید ساخته شود؛ سپس در پنجره‌ی ویرایش، عنوان و توضیح را (در صورت نیاز به هر سه زبان) بنویسید.",
                "Click “New form” to create a lead form, then in the editor set the title and description (in all three languages if you need them).",
                "Klicken Sie auf „Neues Formular“, um ein Lead-Formular zu erstellen, und legen Sie im Editor Titel und Beschreibung fest (bei Bedarf in allen drei Sprachen).")}</li>
              <li>{tri(lang,
                "در بخش «فیلدها» انتخاب کنید کدام فیلد (نام، تلفن، ایمیل، شرکت، پیام) نمایش داده شود و کدام اجباری باشد. فیلد نام همیشه نمایش داده می‌شود.",
                "Under “Fields”, choose which fields (name, phone, email, company, message) are shown and which are required. Name is always shown.",
                "Wählen Sie unter „Felder“, welche Felder (Name, Telefon, E-Mail, Unternehmen, Nachricht) angezeigt werden und welche Pflicht sind. Name wird immer angezeigt.")}</li>
              <li>{tri(lang,
                "رنگ، متن دکمه، پیام موفقیت و در صورت تمایل یک «لینک هدایت» (کاربر بعد از ثبت به آنجا می‌رود) و آدرس لوگو را تنظیم کنید و ذخیره بزنید.",
                "Set the colour, button text, success message, and optionally a redirect URL (where the visitor goes after submitting) and a logo URL, then save.",
                "Legen Sie Farbe, Button-Text, Erfolgsmeldung und optional eine Weiterleitungs-URL (wohin der Besucher nach dem Absenden gelangt) sowie eine Logo-URL fest und speichern Sie.")}</li>
              <li>{tri(lang,
                "با «کپی لینک» آدرس عمومی فرم را بردارید و هرجا خواستید بگذارید (پیام، بیو اینستاگرام، تبلیغات). با «کپی کد امبد» یک قطعه <script> بردارید و در سایت خودتان بچسبانید تا یک دکمه‌ی شناور فرم را باز کند.",
                "Use “Copy link” to get the form's public URL and share it anywhere (DM, Instagram bio, ads). Use “Copy embed code” to get a <script> snippet you paste into your own site — it adds a floating button that opens the form.",
                "Mit „Link kopieren“ erhalten Sie die öffentliche URL des Formulars und können sie überall teilen (DM, Instagram-Bio, Anzeigen). Mit „Einbettungscode kopieren“ erhalten Sie ein <script>-Snippet für Ihre eigene Website — es fügt einen schwebenden Button hinzu, der das Formular öffnet.")}</li>
              <li>{tri(lang,
                "هر ثبت به‌صورت یک مخاطب با وضعیت «لید» و تگ «فرم لید» وارد CRM شما می‌شود و برایش یک امتیاز ۰ تا ۱۰۰ محاسبه می‌شود (تلفن، ایمیل، طول پیام و کمپین روی امتیاز اثر دارند).",
                "Every submission enters your CRM as a contact with status “lead” and the tag “lead form”, and gets a 0–100 score (phone, email, message length and campaign all affect it).",
                "Jede Einsendung landet in Ihrem CRM als Kontakt mit dem Status „Lead“ und dem Tag „Lead-Formular“ und erhält eine Punktzahl von 0–100 (Telefon, E-Mail, Nachrichtenlänge und Kampagne fließen ein).")}</li>
              <li>{tri(lang,
                "برای دیدن ثبت‌های هر فرم، زیر همان فرم روی «ثبت‌ها» بزنید. برای مقایسه‌ی کانال‌ها (فرم لید، لینک ملک، معرفی و…) جدول «تبدیل بر اساس کانال» پایین صفحه را ببینید.",
                "To see a form's submissions, click “Submissions” under it. To compare channels (lead form, property link, referral, …) see the “Conversion by channel” table at the bottom.",
                "Um die Einsendungen eines Formulars zu sehen, klicken Sie darunter auf „Einsendungen“. Zum Vergleich der Kanäle (Lead-Formular, Immobilienlink, Empfehlung …) siehe die Tabelle „Konversion nach Kanal“ unten.")}</li>
              <li>{tri(lang,
                "لیدهای بی‌پاسخ به‌صورت خودکار پیگیری می‌شوند: در روزهای ۲، ۵ و ۱۰ یک پیش‌نویس پیام پیگیری در بخش تسک‌های همان مخاطب در CRM ساخته می‌شود که فقط باید تأیید و ارسال کنید.",
                "Unanswered leads are followed up automatically: on days 2, 5 and 10 a draft follow-up message is created in that contact's Tasks tab in the CRM for you to review and send.",
                "Nicht beantwortete Leads werden automatisch nachverfolgt: An Tag 2, 5 und 10 wird im Aufgaben-Tab des Kontakts im CRM ein Nachfass-Entwurf erstellt, den Sie nur noch prüfen und senden müssen.")}</li>
            </ol>
            <p className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
              {tri(lang,
                "به‌زودی: اتصال مستقیم به فرم‌های لید فیسبوک/اینستاگرام و Google Ads تا لیدهای تبلیغات هم خودکار وارد همین‌جا شوند.",
                "Coming soon: direct connection to Facebook/Instagram lead forms and Google Ads, so leads from your ads also flow in here automatically.",
                "Demnächst: direkte Anbindung an Facebook/Instagram-Lead-Formulare und Google Ads, damit auch Leads aus Ihren Anzeigen automatisch hier eingehen.")}
            </p>
          </div>
        )}
      </div>

      {/* stats */}
      {report && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <Stat icon={Users} label={tri(lang, "کل لیدهای باز", "Open leads", "Offene Leads")} value={report.totalLeads} />
          <Stat icon={Magnet} label={tri(lang, "لید از فرم‌ها", "From forms", "Aus Formularen")} value={report.formLeads} />
          <Stat icon={BarChart3} label={tri(lang, "ثبت فرم‌ها", "Submissions", "Einsendungen")} value={report.formSubmissions} />
          <Stat icon={Flame} label={tri(lang, "میانگین امتیاز", "Avg. score", "Ø Punktzahl")} value={report.avgScore} />
        </div>
      )}

      {/* forms */}
      {loading ? (
        <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : forms.length === 0 ? (
        <p className="text-center py-10 text-sm" style={{ color: "var(--text-muted)" }}>
          {tri(lang, "هنوز فرمی نساخته‌اید.", "No forms yet.", "Noch keine Formulare.")}
        </p>
      ) : (
        <div className="space-y-3 mb-8">
          {forms.map((f) => {
            const publicUrl = `${appOrigin}/f/${f.slug}`;
            const embedTag = `<script src="${appOrigin}/api/public/leadform/${f.slug}/embed" async></script>`;
            return (
              <div key={f.id} className="rounded-xl p-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{f.title}</span>
                      <button onClick={() => toggleActive(f)}
                        className="text-[11px] px-2 py-0.5 rounded-full"
                        style={{ background: f.isActive ? "rgba(34,197,94,0.15)" : "var(--surface-2)", color: f.isActive ? "#16a34a" : "var(--text-muted)" }}>
                        {f.isActive ? tri(lang, "فعال", "Active", "Aktiv") : tri(lang, "غیرفعال", "Off", "Aus")}
                      </button>
                    </div>
                    <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                      {f.submissionCount} {tri(lang, "ثبت", "submissions", "Einsendungen")}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <IconBtn title={tri(lang, "کپی لینک", "Copy link", "Link kopieren")} onClick={() => copy(publicUrl, tri(lang, "لینک کپی شد", "Link copied", "Link kopiert"))}><Copy className="w-4 h-4" /></IconBtn>
                    <IconBtn title={tri(lang, "کپی کد امبد", "Copy embed code", "Einbettungscode kopieren")} onClick={() => copy(embedTag, tri(lang, "کد امبد کپی شد", "Embed code copied", "Einbettungscode kopiert"))}><Code2 className="w-4 h-4" /></IconBtn>
                    <a href={publicUrl} target="_blank" rel="noreferrer" className="p-2 rounded-lg" style={{ background: "var(--surface-2)" }} title={tri(lang, "باز کردن", "Open", "Öffnen")}><ExternalLink className="w-4 h-4" /></a>
                    <IconBtn title={tri(lang, "ویرایش", "Edit", "Bearbeiten")} onClick={() => setEditing(f)}><Pencil className="w-4 h-4" /></IconBtn>
                    <IconBtn title={tri(lang, "حذف", "Delete", "Löschen")} onClick={() => deleteForm(f)}><Trash2 className="w-4 h-4" /></IconBtn>
                  </div>
                </div>

                <button onClick={() => loadSubs(f.id)} className="mt-2 flex items-center gap-1 text-xs font-medium" style={{ color: "#ea580c" }}>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${openSubs === f.id ? "rotate-180" : ""}`} />
                  {tri(lang, "ثبت‌ها", "Submissions", "Einsendungen")}
                </button>

                {openSubs === f.id && (
                  <div className="mt-2 overflow-x-auto">
                    {(subs[f.id] || []).length === 0 ? (
                      <p className="text-xs py-3" style={{ color: "var(--text-muted)" }}>{tri(lang, "هنوز ثبتی نیست.", "No submissions yet.", "Noch keine Einsendungen.")}</p>
                    ) : (
                      <table className="w-full text-xs" style={{ color: "var(--text-secondary)" }}>
                        <thead>
                          <tr style={{ color: "var(--text-muted)" }}>
                            <th className="text-start py-1.5 pe-3">{FIELD_LABELS.name[lang === "tr" ? "en" : lang]}</th>
                            <th className="text-start py-1.5 pe-3">{FIELD_LABELS.phone[lang === "tr" ? "en" : lang]}</th>
                            <th className="text-start py-1.5 pe-3">{FIELD_LABELS.email[lang === "tr" ? "en" : lang]}</th>
                            <th className="text-start py-1.5 pe-3">{tri(lang, "امتیاز", "Score", "Score")}</th>
                            <th className="text-start py-1.5 pe-3">{tri(lang, "کمپین", "Campaign", "Kampagne")}</th>
                            <th className="text-start py-1.5 pe-3">{tri(lang, "تاریخ", "Date", "Datum")}</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {(subs[f.id] || []).map((s) => (
                            <tr key={s.id} style={{ borderTop: "1px solid var(--border)" }}>
                              <td className="py-1.5 pe-3">{s.data.name || "—"}</td>
                              <td className="py-1.5 pe-3" dir="ltr">{s.data.phone || "—"}</td>
                              <td className="py-1.5 pe-3" dir="ltr">{s.data.email || "—"}</td>
                              <td className="py-1.5 pe-3">
                                <span className="px-1.5 py-0.5 rounded" style={{ background: s.score >= 70 ? "rgba(239,68,68,0.15)" : s.score >= 40 ? "rgba(234,179,8,0.15)" : "var(--surface-2)", color: s.score >= 70 ? "#dc2626" : s.score >= 40 ? "#ca8a04" : "var(--text-muted)" }}>{s.score}</span>
                              </td>
                              <td className="py-1.5 pe-3">{s.utmCampaign || "—"}</td>
                              <td className="py-1.5 pe-3 whitespace-nowrap">{new Date(s.createdAt).toLocaleDateString(lang === "fa" ? "fa-IR" : lang === "de" ? "de-DE" : "en-US")}</td>
                              <td className="py-1.5">
                                {s.contactId && (
                                  <Link href={`/crm?contact=${s.contactId}`} className="underline" style={{ color: "#ea580c" }}>
                                    {tri(lang, "در CRM", "In CRM", "Im CRM")}
                                  </Link>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* connectors / channels */}
      <div className="rounded-xl p-4 mb-6" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <h2 className="font-semibold mb-1 text-sm" style={{ color: "var(--text-primary)" }}>
          {tri(lang, "کانال‌های تبلیغاتی", "Ad channels", "Werbekanäle")}
        </h2>
        <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
          {tri(lang,
            "حساب تبلیغاتی خودتان را وصل کنید تا لیدهای فرم‌های تبلیغاتی هم مستقیم وارد CRM شوند.",
            "Connect your own ad account so leads from your ad forms flow straight into the CRM.",
            "Verbinden Sie Ihr eigenes Werbekonto, damit Leads aus Ihren Anzeigenformularen direkt ins CRM gelangen.")}
        </p>

        <div className="flex flex-wrap gap-2 mb-3">
          {(() => {
            const metaRow = connectors.find((c) => c.provider === "meta");
            if (metaRow?.status === "active") return null;
            if (metaRow?.status === "pending") {
              return (
                <span className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm" style={{ background: "rgba(234,179,8,0.15)", color: "#ca8a04" }}>
                  {tri(lang, "درخواست اتصال Meta ثبت شد — در انتظار تأیید", "Meta connection requested — awaiting approval", "Meta-Verbindung angefragt — wartet auf Freigabe")}
                </span>
              );
            }
            if (SELF_SERVE_META) {
              return (
                <a href="/api/leadgen/connectors/meta/start"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white" style={{ background: "#1877f2" }}>
                  {tri(lang, "اتصال به Meta (فیسبوک/اینستاگرام)", "Connect Meta (Facebook/Instagram)", "Meta verbinden (Facebook/Instagram)")}
                </a>
              );
            }
            return (
              <button onClick={requestMeta} disabled={requestingMeta}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white" style={{ background: "#1877f2" }}>
                {requestingMeta ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {tri(lang, "درخواست اتصال Meta", "Request Meta connection", "Meta-Verbindung anfragen")}
              </button>
            );
          })()}
          {!connectors.some((c) => c.provider === "google") && (
            <button onClick={connectGoogle} disabled={connectingGoogle}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium"
              style={{ background: "var(--surface-2)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
              {connectingGoogle ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {tri(lang, "اتصال به Google Ads", "Connect Google Ads", "Google Ads verbinden")}
            </button>
          )}
        </div>

        {connectors.filter((c) => c.status !== "pending").length === 0 ? (
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>{tri(lang, "هنوز کانالی وصل نشده.", "No channels connected yet.", "Noch keine Kanäle verbunden.")}</p>
        ) : (
          <div className="space-y-2">
            {connectors.filter((c) => c.status !== "pending").map((c) => (
              <div key={c.id} className="rounded-lg p-3" style={{ background: "var(--surface-0)", border: "1px solid var(--border)" }}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                      {c.provider === "meta" ? "Meta" : "Google Ads"} — {c.name}
                    </span>
                    <span className="ms-2 text-[11px] px-1.5 py-0.5 rounded-full"
                      style={{ background: c.status === "active" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: c.status === "active" ? "#16a34a" : "#dc2626" }}>
                      {c.status === "active" ? tri(lang, "فعال", "Active", "Aktiv") : tri(lang, "خطا", "Error", "Fehler")}
                    </span>
                    <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                      {c.leadsImported} {tri(lang, "لید دریافت‌شده", "leads received", "Leads erhalten")}
                      {c.lastError ? ` — ${c.lastError}` : ""}
                    </p>
                  </div>
                  <button onClick={() => disconnectConnector(c.id)} className="p-1.5 rounded-lg" style={{ background: "var(--surface-2)" }}>
                    <Trash2 className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                  </button>
                </div>

                {c.provider === "google" && c.webhookUrl && (
                  <div className="mt-2 text-xs space-y-1" style={{ color: "var(--text-secondary)" }}>
                    <p className="font-medium">{tri(lang, "در Google Ads → دارایی فرم لید → «تحویل لید»:", "In Google Ads → Lead form asset → “Lead delivery”:", "In Google Ads → Lead-Formular-Asset → „Lead-Zustellung“:")}</p>
                    <div className="flex items-center gap-1.5">
                      <span className="opacity-70">Webhook URL:</span>
                      <code className="px-1.5 py-0.5 rounded text-[11px] break-all" style={{ background: "var(--surface-2)" }}>{c.webhookUrl}</code>
                      <button onClick={() => copy(c.webhookUrl!, tri(lang, "کپی شد", "Copied", "Kopiert"))}><Copy className="w-3.5 h-3.5" /></button>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="opacity-70">Key:</span>
                      <code className="px-1.5 py-0.5 rounded text-[11px] break-all" style={{ background: "var(--surface-2)" }}>{c.webhookKey}</code>
                      <button onClick={() => copy(c.webhookKey!, tri(lang, "کپی شد", "Copied", "Kopiert"))}><Copy className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* channel report */}
      {report && report.channels.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <h2 className="font-semibold mb-3 text-sm" style={{ color: "var(--text-primary)" }}>
            {tri(lang, "تبدیل بر اساس کانال", "Conversion by channel", "Konversion nach Kanal")}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={{ color: "var(--text-secondary)" }}>
              <thead>
                <tr style={{ color: "var(--text-muted)" }}>
                  <th className="text-start py-1.5 pe-3">{tri(lang, "کانال", "Channel", "Kanal")}</th>
                  <th className="text-start py-1.5 pe-3">{tri(lang, "کل", "Total", "Gesamt")}</th>
                  <th className="text-start py-1.5 pe-3">{tri(lang, "واجد شرایط", "Qualified", "Qualifiziert")}</th>
                  <th className="text-start py-1.5 pe-3">{tri(lang, "مشتری", "Customer", "Kunde")}</th>
                  <th className="text-start py-1.5 pe-3">{tri(lang, "نرخ تبدیل", "Conv. rate", "Konv.-Rate")}</th>
                </tr>
              </thead>
              <tbody>
                {report.channels.map((c) => (
                  <tr key={c.source} style={{ borderTop: "1px solid var(--border)" }}>
                    <td className="py-1.5 pe-3">{sourceLabel(c.source)}</td>
                    <td className="py-1.5 pe-3">{c.total}</td>
                    <td className="py-1.5 pe-3">{c.qualified}</td>
                    <td className="py-1.5 pe-3">{c.customer}</td>
                    <td className="py-1.5 pe-3">{c.conversionRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editing && (
        <EditModal
          form={editing}
          lang={lang}
          onClose={() => setEditing(null)}
          onSave={saveForm}
        />
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) {
  return (
    <div className="rounded-xl p-3" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
      <Icon className="w-4 h-4 mb-1.5" style={{ color: "#ea580c" }} />
      <div className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{value}</div>
      <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>{label}</div>
    </div>
  );
}

function IconBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button onClick={onClick} title={title} className="p-2 rounded-lg" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
      {children}
    </button>
  );
}

function EditModal({ form, lang, onClose, onSave }: {
  form: LeadFormRow; lang: "fa" | "en" | "de" | "tr"; onClose: () => void; onSave: (f: LeadFormRow) => void;
}) {
  const [f, setF] = useState<LeadFormRow>(form);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof LeadFormRow>(k: K, v: LeadFormRow[K]) => setF((p) => ({ ...p, [k]: v }));

  async function uploadLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const body = new FormData();
      body.append("file", await downscaleImage(file, { maxEdge: 400 }));
      const res = await fetch("/api/upload", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      set("logoUrl", data.url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tri(lang, "خطا در آپلود", "Upload failed", "Upload fehlgeschlagen"));
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  }

  const setField = (key: LeadFieldKey, prop: "show" | "required", val: boolean) =>
    setF((p) => {
      const next = { ...p.fields, [key]: { ...p.fields[key], [prop]: val } };
      if (prop === "show" && !val) next[key].required = false;
      if (key === "name") next.name.show = true;
      return { ...p, fields: next };
    });

  const fieldLabel = (k: LeadFieldKey) => FIELD_LABELS[k][lang === "tr" ? "en" : lang];

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl p-5 max-h-[90vh] overflow-y-auto" style={{ background: "var(--surface-0)" }} onClick={(e) => e.stopPropagation()} dir={lang === "fa" ? "rtl" : "ltr"}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold" style={{ color: "var(--text-primary)" }}>{tri(lang, "ویرایش فرم", "Edit form", "Formular bearbeiten")}</h3>
          <button onClick={onClose}><X className="w-5 h-5" style={{ color: "var(--text-muted)" }} /></button>
        </div>

        <div className="space-y-3">
          <Field label={tri(lang, "عنوان (فارسی)", "Title (Persian)", "Titel (Persisch)")} value={f.title} onChange={(v) => set("title", v)} />
          <Field label={tri(lang, "عنوان (انگلیسی)", "Title (English)", "Titel (Englisch)")} value={f.titleEn || ""} onChange={(v) => set("titleEn", v || null)} />
          <Field label={tri(lang, "عنوان (آلمانی)", "Title (German)", "Titel (Deutsch)")} value={f.titleDe || ""} onChange={(v) => set("titleDe", v || null)} />
          <Field label={tri(lang, "توضیح (فارسی)", "Description (Persian)", "Beschreibung (Persisch)")} value={f.description || ""} onChange={(v) => set("description", v || null)} textarea />
          <Field label={tri(lang, "توضیح (انگلیسی)", "Description (English)", "Beschreibung (Englisch)")} value={f.descriptionEn || ""} onChange={(v) => set("descriptionEn", v || null)} textarea />
          <Field label={tri(lang, "توضیح (آلمانی)", "Description (German)", "Beschreibung (Deutsch)")} value={f.descriptionDe || ""} onChange={(v) => set("descriptionDe", v || null)} textarea />

          <div>
            <p className="text-xs font-semibold mb-1.5" style={{ color: "var(--text-secondary)" }}>{tri(lang, "فیلدها", "Fields", "Felder")}</p>
            <div className="space-y-1.5">
              {LEAD_FIELD_KEYS.map((k) => (
                <div key={k} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: "var(--surface-1)" }}>
                  <span className="text-sm" style={{ color: "var(--text-primary)" }}>{fieldLabel(k)}</span>
                  <div className="flex items-center gap-3 text-xs">
                    <label className="flex items-center gap-1" style={{ color: "var(--text-secondary)" }}>
                      <input type="checkbox" checked={f.fields[k].show} disabled={k === "name"} onChange={(e) => setField(k, "show", e.target.checked)} />
                      {tri(lang, "نمایش", "Show", "Zeigen")}
                    </label>
                    <label className="flex items-center gap-1" style={{ color: "var(--text-secondary)" }}>
                      <input type="checkbox" checked={f.fields[k].required} disabled={!f.fields[k].show} onChange={(e) => setField(k, "required", e.target.checked)} />
                      {tri(lang, "اجباری", "Required", "Pflicht")}
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>{tri(lang, "رنگ", "Colour", "Farbe")}</label>
            <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(f.accentColor) ? f.accentColor : "#ea580c"} onChange={(e) => set("accentColor", e.target.value)} />
          </div>
          <Field label={tri(lang, "متن دکمه", "Button text", "Button-Text")} value={f.submitLabel || ""} onChange={(v) => set("submitLabel", v || null)} />
          <Field label={tri(lang, "پیام موفقیت", "Success message", "Erfolgsmeldung")} value={f.successMessage || ""} onChange={(v) => set("successMessage", v || null)} />
          <Field label={tri(lang, "لینک هدایت بعد از ثبت (اختیاری)", "Redirect URL after submit (optional)", "Weiterleitungs-URL nach Absenden (optional)")} value={f.redirectUrl || ""} onChange={(v) => set("redirectUrl", v || null)} />

          <div>
            <label className="text-xs font-semibold block mb-1" style={{ color: "var(--text-secondary)" }}>
              {tri(lang, "لوگو (اختیاری)", "Logo (optional)", "Logo (optional)")}
            </label>
            <div className="flex items-center gap-3">
              {f.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f.logoUrl} alt="" className="w-12 h-12 rounded-lg object-contain" style={{ background: "var(--surface-2)" }} />
              ) : (
                <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ background: "var(--surface-2)", color: "var(--text-muted)" }}>
                  <Magnet className="w-5 h-5" />
                </div>
              )}
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={uploadLogo} />
              <button type="button" onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
                {uploadingLogo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {f.logoUrl ? tri(lang, "تغییر عکس", "Change image", "Bild ändern") : tri(lang, "انتخاب عکس", "Choose image", "Bild wählen")}
              </button>
              {f.logoUrl && (
                <button type="button" onClick={() => set("logoUrl", null)} className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {tri(lang, "حذف", "Remove", "Entfernen")}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={async () => { setSaving(true); await onSave(f); setSaving(false); }} disabled={saving}
            className="flex-1 py-2.5 rounded-xl font-semibold text-white flex items-center justify-center gap-2" style={{ background: "linear-gradient(135deg,#ea580c,#f97316)" }}>
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {tri(lang, "ذخیره", "Save", "Speichern")}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}>
            {tri(lang, "انصراف", "Cancel", "Abbrechen")}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, textarea }: { label: string; value: string; onChange: (v: string) => void; textarea?: boolean }) {
  return (
    <div>
      <label className="text-xs font-semibold block mb-1" style={{ color: "var(--text-secondary)" }}>{label}</label>
      {textarea ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2}
          className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
      )}
    </div>
  );
}
