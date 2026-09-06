"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { ArrowRight, ArrowLeft, Sparkles, Plus, Trash2, Send, CheckCircle2, Home, Printer } from "lucide-react";
import { useCompanyLogo } from "@/lib/hooks/useCompanyLogo";
import { tri, type Lang } from "@/lib/i18n";
import { useAccountingLocale } from "@/lib/accounting/useAccountingLocale";
import AccountingNav from "@/components/accounting/AccountingNav";
import { parseJsonResponse } from "@/lib/utils/fetchJson";

interface Property {
  id: string;
  title: string;
  listingType: string;
  currency: string;
}

interface LineItem {
  date: string;
  description: string;
  category: "guest_stay" | "maintenance" | "utilities" | "consumables" | "other";
  income: string;
  expense: string;
  source?: "booking" | "ai_parsed";
}

interface Statement {
  id: string;
  month: string;
  status: "draft" | "approved" | "sent";
  incomeTotal: number;
  expenseTotal: number;
  netProfit: number;
  managementFee: number;
  ownerShare: number;
  currency: string;
  property: { title: string };
}

interface StatementDetail extends Statement {
  entries: { id: string; date: string; description: string; category: LineItem["category"]; income: number; expense: number }[];
}

function categoryLabel(cat: LineItem["category"], lang: Lang): string {
  switch (cat) {
    case "guest_stay": return tri(lang, "اقامت مهمان", "Guest stay", "Gastaufenthalt");
    case "maintenance": return tri(lang, "تعمیر و نگهداری", "Maintenance", "Instandhaltung");
    case "utilities": return tri(lang, "قبوض", "Utilities", "Nebenkosten");
    case "consumables": return tri(lang, "مصرفی", "Consumables", "Verbrauchsmaterial");
    default: return tri(lang, "سایر", "Other", "Sonstiges");
  }
}

const STATUS_STYLE: Record<Statement["status"], { color: string; bg: string }> = {
  draft: { color: "var(--text-secondary)", bg: "var(--surface-2)" },
  approved: { color: "#eda100", bg: "rgba(237,161,0,0.12)" },
  sent: { color: "var(--pos)", bg: "rgba(27,175,122,0.12)" },
};

function statusLabel(status: Statement["status"], lang: Lang): string {
  switch (status) {
    case "draft": return tri(lang, "پیش‌نویس", "Draft", "Entwurf");
    case "approved": return tri(lang, "تأییدشده", "Approved", "Genehmigt");
    default: return tri(lang, "ارسال‌شده", "Sent", "Gesendet");
  }
}

// Digit formatting follows the statement's CURRENCY, never the admin's own
// UI language -- a Persian-speaking admin looking at a Lira/Dollar/Pound
// amount owed to a non-Iranian owner must see ordinary Western digits,
// exactly as that owner will see them on the same PDF; a Toman/Rial amount
// stays in Persian digits regardless of the admin's UI language.
function fmt(n: number, currency?: string): string {
  const isFaCurrency = currency === "IRT" || currency === "IRR";
  return Math.round(n).toLocaleString(isFaCurrency ? "fa-IR" : "en-US");
}

function emptyLine(): LineItem {
  return { date: new Date().toISOString().slice(0, 10), description: "", category: "other", income: "", expense: "" };
}

export default function OwnerStatementsPage() {
  const { lang, dir, fmtMonth } = useAccountingLocale();
  const [properties, setProperties] = useState<Property[]>([]);
  // Without this the dropdown looks identical while loading and when the
  // workspace genuinely has no short-term rental units — which is how this
  // page came to say "select a unit first" with nothing to select.
  const [propertiesLoading, setPropertiesLoading] = useState(true);
  const [propertyId, setPropertyId] = useState("");
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineItem[]>([]);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [assisting, setAssisting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [printStatement, setPrintStatement] = useState<StatementDetail | null>(null);
  const [feePercent, setFeePercent] = useState<string>("20");
  const [feeSource, setFeeSource] = useState<"property" | "workspace_default" | "hardcoded_default">("hardcoded_default");
  const [savingFee, setSavingFee] = useState(false);

  const selectedProperty = properties.find((p) => p.id === propertyId);

  const loadFeePercent = useCallback(async (pid: string) => {
    if (!pid) return;
    const res = await fetch(`/api/accounting/management-fee-rules?propertyId=${pid}`, { credentials: "include" });
    const j = await parseJsonResponse(res, lang);
    if (res.ok) { setFeePercent(String(j.feePercent)); setFeeSource(j.source); }
    // `lang` is read for the error messages, so it belongs in the deps.
  }, [lang]);

  useEffect(() => { loadFeePercent(propertyId); }, [propertyId, loadFeePercent]);

  async function saveFeePercent() {
    const value = Number(feePercent);
    if (!propertyId) return toast.error(tri(lang, "ابتدا یک واحد را انتخاب کنید", "Select a unit first", "Wählen Sie zuerst eine Einheit"));
    if (isNaN(value) || value < 0 || value > 100) return toast.error(tri(lang, "درصد کارمزد باید بین ۰ تا ۱۰۰ باشد", "Fee percent must be between 0 and 100", "Der Gebührensatz muss zwischen 0 und 100 liegen"));
    setSavingFee(true);
    try {
      const res = await fetch("/api/accounting/management-fee-rules", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId, feePercent: value }),
      });
      const j = await parseJsonResponse(res, lang);
      if (!res.ok) throw new Error(j.error);
      toast.success(tri(lang, "درصد کارمزد این واحد ذخیره شد", "Management fee saved for this unit", "Verwaltungsgebühr für diese Einheit gespeichert"));
      setFeeSource("property");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tri(lang, "خطا در ذخیرهٔ درصد کارمزد", "Failed to save the fee percent", "Gebührensatz konnte nicht gespeichert werden"));
    } finally {
      setSavingFee(false);
    }
  }

  async function openPrint(id: string) {
    try {
      const res = await fetch(`/api/accounting/owner-statements/${id}`, { credentials: "include" });
      const j = await parseJsonResponse(res, lang);
      if (!res.ok) throw new Error(j.error);
      setPrintStatement(j.statement);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tri(lang, "خطا در بارگذاری گزارش", "Failed to load the statement", "Abrechnung konnte nicht geladen werden"));
    }
  }

  useEffect(() => {
    fetch("/api/crm/properties?listingType=short_term_rent", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setProperties(d.properties || []))
      .catch(() => {})
      .finally(() => setPropertiesLoading(false));
  }, []);

  const loadStatements = useCallback(async (pid: string) => {
    if (!pid) { setStatements([]); return; }
    const res = await fetch(`/api/accounting/owner-statements?propertyId=${pid}`, { credentials: "include" });
    const j = await parseJsonResponse(res, lang);
    if (res.ok) setStatements(j.statements);
    // `lang` is read for the error messages, so it belongs in the deps.
  }, [lang]);

  useEffect(() => { loadStatements(propertyId); }, [propertyId, loadStatements]);

  async function getAiSuggestions() {
    if (!propertyId) return toast.error(tri(lang, "ابتدا یک واحد را انتخاب کنید", "Select a unit first", "Wählen Sie zuerst eine Einheit"));
    setAssisting(true);
    try {
      const res = await fetch("/api/accounting/ai/owner-statement-assist", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId, month: `${month}-01`, notes: notes || undefined }),
      });
      const j = await parseJsonResponse(res, lang);
      if (!res.ok) throw new Error(j.error);
      const suggested: LineItem[] = j.lines.map((l: { date: string; description: string; category: LineItem["category"]; income?: number; expense?: number; source: string }) => ({
        date: l.date.slice(0, 10),
        description: l.description,
        category: l.category,
        income: l.income ? String(l.income) : "",
        expense: l.expense ? String(l.expense) : "",
        source: l.source,
      }));
      setLines((prev) => [...prev, ...suggested]);
      toast.success(tri(lang,
        `${suggested.length} ردیف پیشنهادی اضافه شد — قبل از ساخت گزارش بازبینی کنید`,
        `${suggested.length} suggested lines added — review them before creating the statement`,
        `${suggested.length} vorgeschlagene Positionen hinzugefügt — bitte vor Erstellung prüfen`));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tri(lang, "خطا در دریافت پیشنهاد", "Failed to get suggestions", "Vorschläge konnten nicht geladen werden"));
    } finally {
      setAssisting(false);
    }
  }

  function updateLine(i: number, patch: Partial<LineItem>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function createStatement() {
    if (!propertyId) return toast.error(tri(lang, "ابتدا یک واحد را انتخاب کنید", "Select a unit first", "Wählen Sie zuerst eine Einheit"));
    if (lines.length === 0) return toast.error(tri(lang, "حداقل یک ردیف لازم است", "At least one line item is required", "Mindestens eine Position ist erforderlich"));
    setBusy(true);
    try {
      const res = await fetch("/api/accounting/owner-statements", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId, month: `${month}-01`,
          currency: selectedProperty?.currency || "IRT",
          entries: lines.map((l) => ({ date: l.date, description: l.description, category: l.category, income: Number(l.income) || 0, expense: Number(l.expense) || 0 })),
        }),
      });
      const j = await parseJsonResponse(res, lang);
      if (!res.ok) throw new Error(j.error);
      toast.success(tri(lang, "گزارش تسویه ساخته شد", "Statement created", "Abrechnung erstellt"));
      setLines([]);
      setNotes("");
      loadStatements(propertyId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tri(lang, "خطا در ساخت گزارش", "Failed to create the statement", "Abrechnung konnte nicht erstellt werden"));
    } finally {
      setBusy(false);
    }
  }

  async function statementAction(id: string, action: "approve" | "send" | "reopen") {
    if (action === "reopen" && !confirm(tri(lang,
      "این گزارش قبلاً تأیید/ارسال شده. بازگشایی آن، سند ثبت‌شدهٔ آن در دفتر کل را برمی‌گرداند تا بتوانید دوباره بسازید. ادامه می‌دهید؟",
      "This statement was already approved/sent. Reopening it reverses its posted ledger entry so you can regenerate it. Continue?",
      "Diese Abrechnung wurde bereits genehmigt/gesendet. Beim Wiederöffnen wird die gebuchte Journalbuchung storniert, damit Sie sie neu erstellen können. Fortfahren?"))) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/accounting/owner-statements/${id}`, {
        method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const j = await parseJsonResponse(res, lang);
      if (!res.ok) throw new Error(j.error);
      toast.success(action === "approve" ? tri(lang, "گزارش تأیید شد", "Statement approved", "Abrechnung genehmigt") : action === "send" ? tri(lang, "برای مالک ارسال شد", "Sent to the owner", "An den Eigentümer gesendet") : tri(lang, "گزارش بازگشایی شد — حالا می‌توانید دوباره بسازید", "Statement reopened — you can regenerate it now", "Abrechnung wieder geöffnet — Sie können sie neu erstellen"));
      loadStatements(propertyId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tri(lang, "خطا", "Something went wrong", "Ein Fehler ist aufgetreten"));
    } finally {
      setBusy(false);
    }
  }

  const incomeTotal = lines.reduce((s, l) => s + (Number(l.income) || 0), 0);
  const expenseTotal = lines.reduce((s, l) => s + (Number(l.expense) || 0), 0);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6" dir={dir}>
      <AccountingNav />
      <div className="flex items-center gap-2">
        {/* the back chevron must point the way "back" actually is in this direction */}
        <Link href="/accounting" className="p-1.5 rounded-lg" style={{ color: "var(--text-secondary)" }}>{dir === "rtl" ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}</Link>
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{tri(lang, "گزارش تسویه مالک (اجاره کوتاه‌مدت)", "Owner statements (short-term rental)", "Eigentümerabrechnungen (Kurzzeitvermietung)")}</h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>{tri(lang, "با کمک دستیار هوشمند، ردیف‌های ماهانه را پیشنهاد بگیرید و پیش از ارسال بازبینی کنید", "Let the AI assistant draft the month's line items, then review them before sending", "Lassen Sie den KI-Assistenten die Monatsposten entwerfen und prüfen Sie sie vor dem Senden")}</p>
        </div>
      </div>

      {/* Property + month picker */}
      <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <div className="flex flex-wrap gap-2 items-center mb-3">
          <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)} disabled={propertiesLoading || properties.length === 0}
            className="px-3 py-2 rounded-lg text-sm flex-1 min-w-[180px] disabled:opacity-60" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
            <option value="">
              {propertiesLoading
                ? tri(lang, "در حال بارگذاری واحدها...", "Loading units…", "Einheiten werden geladen…")
                : properties.length === 0
                ? tri(lang, "هیچ واحد اجاره کوتاه‌مدتی ثبت نشده", "No short-term rental units yet", "Noch keine Kurzzeitmiet-Einheiten")
                : tri(lang, "انتخاب واحد اجاره کوتاه‌مدت", "Select a short-term rental unit", "Kurzzeitmiet-Einheit auswählen")}
            </option>
            {properties.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="px-3 py-2 rounded-lg text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
        </div>

        {/* A statement needs a short-term rental unit with an owner attached.
            Saying so (with the link) beats an empty dropdown the reader has to
            reverse-engineer. */}
        {!propertiesLoading && properties.length === 0 && (
          <div className="rounded-xl p-4 text-sm mb-3" style={{ background: "var(--surface-2)", border: "1px dashed var(--border)", color: "var(--text-secondary)" }}>
            <p className="mb-2">{tri(lang,
              "برای ساخت گزارش تسویه، اول باید یک ملک با نوع «اجاره کوتاه‌مدت» ثبت کنید و مالکش را مشخص کنید.",
              "To build an owner statement you first need a property with listing type \"short-term rental\", with its owner set.",
              "Für eine Eigentümerabrechnung brauchen Sie zuerst eine Immobilie vom Typ „Kurzzeitvermietung\" mit hinterlegtem Eigentümer.")}</p>
            <Link href="/crm?tab=properties" className="text-xs font-medium" style={{ color: "var(--primary)" }}>
              {tri(lang, "رفتن به بخش ملک‌ها ←", "Go to Properties →", "Zu den Immobilien →")}
            </Link>
          </div>
        )}

        {propertyId && (
          <div className="flex items-center gap-2 mb-3 text-sm">
            <span style={{ color: "var(--text-secondary)" }}>{tri(lang, "درصد کارمزد مدیریت این واحد:", "Management fee for this unit:", "Verwaltungsgebühr für diese Einheit:")}</span>
            <input value={feePercent} onChange={(e) => setFeePercent(e.target.value)} type="number" min="0" max="100" className="w-20 px-2 py-1.5 rounded-lg text-sm" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            <span style={{ color: "var(--text-secondary)" }}>%</span>
            <button disabled={savingFee} onClick={saveFeePercent} className="text-xs px-2.5 py-1.5 rounded-lg font-medium" style={{ background: "var(--surface-2)", color: "var(--primary)" }}>{tri(lang, "ذخیره", "Save", "Speichern")}</button>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {feeSource === "property"
                ? tri(lang, "(اختصاصی این واحد)", "(specific to this unit)", "(spezifisch für diese Einheit)")
                : feeSource === "workspace_default"
                ? tri(lang, "(پیش‌فرض کارگاه)", "(workspace default)", "(Workspace-Standard)")
                : tri(lang, "(پیش‌فرض سیستم — ۲۰٪)", "(system default — 20%)", "(Systemstandard — 20 %)")}
            </span>
          </div>
        )}

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={tri(lang,
            "یادداشت آزاد این ماه (اختیاری) — مثلاً: «آب و برق ۲۰۰ هزار تومان، تمیزکاری ۵۰۰ هزار تومان»",
            "Free-form notes for this month (optional) — e.g. \"utilities 200, cleaning 500\"",
            "Freitext-Notizen für diesen Monat (optional) — z. B. „Nebenkosten 200, Reinigung 500\"")}
          rows={2}
          className="w-full px-3 py-2 rounded-lg text-sm mb-3"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
        />

        <div className="flex gap-2">
          <button disabled={assisting || !propertyId} onClick={getAiSuggestions} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50" style={{ background: "var(--surface-2)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
            <Sparkles className="w-4 h-4" />{assisting ? tri(lang, "در حال دریافت پیشنهاد...", "Getting suggestions…", "Vorschläge werden geladen…") : tri(lang, "دریافت پیشنهاد هوشمند", "Get AI suggestions", "KI-Vorschläge holen")}
          </button>
          <button onClick={() => setLines((prev) => [...prev, emptyLine()])} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium" style={{ background: "var(--surface-2)", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
            <Plus className="w-4 h-4" />{tri(lang, "افزودن ردیف دستی", "Add line manually", "Position manuell hinzufügen")}
          </button>
        </div>
        <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>{tri(lang,
          "ردیف‌های «اقامت مهمان» مستقیماً از رزروهای ثبت‌شده محاسبه می‌شوند (عدد دقیق، نه تخمین). ردیف‌های استخراج‌شده از یادداشت باید قبل از ساخت گزارش بازبینی شوند.",
          "\"Guest stay\" lines are computed directly from recorded bookings (exact figures, not estimates). Lines extracted from your notes must be reviewed before the statement is created.",
          "„Gastaufenthalt\"-Positionen werden direkt aus erfassten Buchungen berechnet (exakte Zahlen, keine Schätzungen). Aus Notizen extrahierte Positionen müssen vor Erstellung der Abrechnung geprüft werden.")}</p>
      </div>

      {/* Line items */}
      {lines.length > 0 && (
        <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>{tri(lang, "ردیف‌های ماه", "This month's line items", "Positionen dieses Monats")}</h2>
          <div className="space-y-2">
            {lines.map((l, i) => (
              <div key={i} className="rounded-xl p-3 flex flex-wrap gap-2 items-center" style={{ background: "var(--surface-2)" }}>
                <input type="date" value={l.date} onChange={(e) => updateLine(i, { date: e.target.value })} className="px-2 py-1.5 rounded-md text-xs" style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                <input value={l.description} onChange={(e) => updateLine(i, { description: e.target.value })} placeholder={tri(lang, "شرح", "Description", "Beschreibung")} className="flex-1 min-w-[140px] px-2 py-1.5 rounded-md text-xs" style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
                <select value={l.category} onChange={(e) => updateLine(i, { category: e.target.value as LineItem["category"] })} className="px-2 py-1.5 rounded-md text-xs" style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
                  {(["guest_stay", "maintenance", "utilities", "consumables", "other"] as const).map((k) => <option key={k} value={k}>{categoryLabel(k, lang)}</option>)}
                </select>
                <input value={l.income} onChange={(e) => updateLine(i, { income: e.target.value })} placeholder={tri(lang, "درآمد", "Income", "Einnahmen")} type="number" className="w-24 px-2 py-1.5 rounded-md text-xs" style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--pos)" }} />
                <input value={l.expense} onChange={(e) => updateLine(i, { expense: e.target.value })} placeholder={tri(lang, "هزینه", "Expense", "Ausgabe")} type="number" className="w-24 px-2 py-1.5 rounded-md text-xs" style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--neg)" }} />
                {l.source === "ai_parsed" && <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "rgba(237,161,0,0.12)", color: "#eda100" }}>{tri(lang, "پیشنهاد AI", "AI suggested", "KI-Vorschlag")}</span>}
                {l.source === "booking" && <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: "rgba(27,175,122,0.12)", color: "var(--pos)" }}>{tri(lang, "از رزرو", "From booking", "Aus Buchung")}</span>}
                <button onClick={() => removeLine(i)} className="p-1.5 rounded-lg" style={{ color: "var(--neg)" }}><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-4 pt-3 text-sm" style={{ borderTop: "1px solid var(--border)" }}>
            <div className="flex gap-4">
              <span style={{ color: "var(--text-secondary)" }}>{tri(lang, "جمع درآمد:", "Total income:", "Gesamteinnahmen:")} <b style={{ color: "var(--pos)" }}>{fmt(incomeTotal, selectedProperty?.currency)}</b></span>
              <span style={{ color: "var(--text-secondary)" }}>{tri(lang, "جمع هزینه:", "Total expenses:", "Gesamtausgaben:")} <b style={{ color: "var(--neg)" }}>{fmt(expenseTotal, selectedProperty?.currency)}</b></span>
              <span style={{ color: "var(--text-secondary)" }}>{tri(lang, "سود خالص:", "Net profit:", "Nettogewinn:")} <b style={{ color: "var(--text-primary)" }}>{fmt(incomeTotal - expenseTotal, selectedProperty?.currency)}</b></span>
            </div>
            <button disabled={busy} onClick={createStatement} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: "var(--primary)", color: "#fff" }}>{tri(lang, "ساخت گزارش تسویه", "Create statement", "Abrechnung erstellen")}</button>
          </div>
        </div>
      )}

      {/* Existing statements */}
      {propertyId && (
        <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}><Home className="w-4 h-4" />{tri(lang, "تاریخچه گزارش‌های این واحد", "Statement history for this unit", "Abrechnungsverlauf dieser Einheit")}</h2>
          {statements.length === 0 ? (
            <p className="text-xs py-2" style={{ color: "var(--text-muted)" }}>{tri(lang, "هنوز گزارشی ساخته نشده", "No statements created yet", "Noch keine Abrechnungen erstellt")}</p>
          ) : (
            <div className="space-y-2">
              {statements.map((s) => {
                const st = STATUS_STYLE[s.status];
                return (
                  <div key={s.id} className="rounded-xl p-3" style={{ background: "var(--surface-2)" }}>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{fmtMonth(s.month, s.currency)}</span>
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: st.bg, color: st.color }}>{statusLabel(s.status, lang)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {s.status === "draft" && (
                          <button disabled={busy} onClick={() => statementAction(s.id, "approve")} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-medium" style={{ background: "var(--primary)", color: "#fff" }}>
                            <CheckCircle2 className="w-3.5 h-3.5" />{tri(lang, "تأیید", "Approve", "Genehmigen")}
                          </button>
                        )}
                        {s.status === "approved" && (
                          <button disabled={busy} onClick={() => statementAction(s.id, "send")} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-medium" style={{ background: "var(--pos)", color: "#fff" }}>
                            <Send className="w-3.5 h-3.5" />{tri(lang, "ارسال به مالک", "Send to owner", "An Eigentümer senden")}
                          </button>
                        )}
                        {(s.status === "approved" || s.status === "sent") && (
                          <button disabled={busy} onClick={() => statementAction(s.id, "reopen")} className="text-xs px-2.5 py-1.5 rounded-lg font-medium" style={{ background: "var(--surface-1)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                            {tri(lang, "بازگشایی برای اصلاح", "Reopen to correct", "Zur Korrektur wieder öffnen")}
                          </button>
                        )}
                        <button onClick={() => openPrint(s.id)} className="p-1.5 rounded-lg" style={{ color: "var(--text-secondary)" }} title={tri(lang, "چاپ گزارش", "Print statement", "Abrechnung drucken")}><Printer className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-2 text-xs" style={{ color: "var(--text-secondary)" }}>
                      <span>{tri(lang, "سود خالص:", "Net profit:", "Nettogewinn:")} {fmt(s.netProfit, s.currency)}</span>
                      <span>{tri(lang, "کارمزد مدیریت:", "Management fee:", "Verwaltungsgebühr:")} {fmt(s.managementFee, s.currency)}</span>
                      <span>{tri(lang, "سهم مالک:", "Owner share:", "Eigentümeranteil:")} {fmt(s.ownerShare, s.currency)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {printStatement && <OwnerStatementPrintModal statement={printStatement} onClose={() => setPrintStatement(null)} />}
    </div>
  );
}

function OwnerStatementPrintModal({ statement, onClose }: { statement: StatementDetail; onClose: () => void }) {
  const { lang, dir, fmtMonth, fmtDate } = useAccountingLocale();
  // The printed sheet goes to the OWNER, so its dates/digits follow the
  // statement's own currency (see useAccountingLocale) rather than whoever
  // happens to be printing it.
  const monthLabel = fmtMonth(statement.month, statement.currency);
  const logoUrl = useCompanyLogo();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:p-0 print:static" style={{ background: "rgba(0,0,0,0.6)" }}>
      <div className="print:hidden absolute top-4 left-4 flex gap-2">
        <button onClick={() => window.print()} className="px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ background: "var(--primary)" }}>{tri(lang, "چاپ / ذخیره PDF", "Print / Save PDF", "Drucken / Als PDF speichern")}</button>
        <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium" style={{ background: "var(--surface-2)", color: "var(--text-primary)" }}>{tri(lang, "بستن", "Close", "Schließen")}</button>
      </div>
      <div dir={dir} className="w-full max-w-2xl rounded-2xl p-8 space-y-4 max-h-[85vh] overflow-y-auto print:max-h-none print:overflow-visible print:shadow-none print:rounded-none" style={{ background: "#fff", color: "#111" }}>
        {logoUrl && <img src={logoUrl} alt="logo" className="h-10 object-contain" style={{ maxWidth: 160 }} />}
        <div className="border-b pb-3">
          <h2 className="text-lg font-bold">{statement.property.title}</h2>
          <span className="text-xs text-gray-500">{monthLabel}</span>
        </div>
        <table className="w-full text-xs">
          <thead><tr className="border-b text-gray-500"><th className="text-start py-1">{tri(lang, "تاریخ", "Date", "Datum")}</th><th className="text-start py-1">{tri(lang, "شرح", "Description", "Beschreibung")}</th><th className="text-end py-1">{tri(lang, "درآمد", "Income", "Einnahmen")}</th><th className="text-end py-1">{tri(lang, "هزینه", "Expense", "Ausgabe")}</th></tr></thead>
          <tbody>
            {statement.entries.map((e) => (
              <tr key={e.id} className="border-b">
                <td className="py-1">{fmtDate(e.date, statement.currency)}</td>
                <td className="py-1">{e.description}</td>
                <td className="py-1 text-end text-green-700">{e.income ? fmt(e.income, statement.currency) : ""}</td>
                <td className="py-1 text-end text-red-700">{e.expense ? fmt(e.expense, statement.currency) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <table className="w-full text-sm mt-4">
          <tbody>
            <tr className="border-b"><td className="py-2 text-gray-500">{tri(lang, "سود خالص", "Net profit", "Nettogewinn")}</td><td className="py-2 text-end font-bold">{fmt(statement.netProfit, statement.currency)} {statement.currency}</td></tr>
            <tr className="border-b"><td className="py-2 text-gray-500">{tri(lang, "کارمزد مدیریت", "Management fee", "Verwaltungsgebühr")}</td><td className="py-2 text-end">{fmt(statement.managementFee, statement.currency)} {statement.currency}</td></tr>
            <tr><td className="py-2 font-bold">{tri(lang, "سهم مالک", "Owner share", "Eigentümeranteil")}</td><td className="py-2 text-end font-bold" style={{ color: "#ea580c" }}>{fmt(statement.ownerShare, statement.currency)} {statement.currency}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
