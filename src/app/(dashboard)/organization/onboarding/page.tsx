"use client";

import { Building2, CheckCircle2, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { tri, useTranslation } from "@/lib/i18n";
import { COUNTRIES } from "@/lib/constants/countries";
import { CURRENCIES } from "@/lib/constants/currencies";
import { TIMEZONES } from "@/lib/constants/timezones";

type Group = { organization: { id: string; name: string }; businesses: { id: string; name: string }[] };
const MODULES = ["CRM", "Sales", "Lead generation", "Social media", "Accounting", "AI Call Center", "Content Studio", "SEO", "Automations", "Analytics"];
const LANGUAGES = [
  { value: "fa", label: "فارسی" },
  { value: "en", label: "English" },
  { value: "de", label: "Deutsch" },
  { value: "tr", label: "Türkçe" },
];

const selectStyle = { background: "var(--surface-2)", border: "1px solid var(--border)" } as const;

export default function BusinessOnboardingPage() {
  const { lang } = useTranslation();
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({ organizationId: "", name: "", industry: "", description: "", country: "", timezone: "Asia/Tehran", currency: "USD", language: lang as string, modules: [] as string[] });
  useEffect(() => { fetch("/api/organizations").then((r) => r.json()).then((data) => { const rows = data.organizations || []; setGroups(rows); setForm((value) => ({ ...value, organizationId: rows[0]?.organization?.id || "" })); }).catch(() => {}); }, []);
  const next = () => { if (step === 1 && form.name.trim().length < 2) return; setStep((value) => Math.min(3, value + 1)); };
  const toggleModule = (module: string) => setForm((value) => ({ ...value, modules: value.modules.includes(module) ? value.modules.filter((item) => item !== module) : [...value.modules, module] }));
  async function submit() {
    if (!form.organizationId || form.name.trim().length < 2) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/organizations/${form.organizationId}/businesses`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await response.json();
      if (!response.ok) return;
      await fetch("/api/organizations/context", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ businessId: data.business.id }) });
      setDone(true);
    } finally { setSaving(false); }
  }
  // A full reload, not router.push(): every already-mounted page (Home, CRM, chat
  // history, accounting, social/Instagram...) reads the active business once on mount
  // and has no reason to refetch just because navigation happened -- same fix as the
  // business switcher.
  const goToDashboard = () => { window.location.href = "/home"; };
  if (done) return <div className="max-w-xl mx-auto p-6 md:p-12 text-center"><CheckCircle2 className="w-14 h-14 mx-auto mb-4" style={{ color: "#10b981" }} /><h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{tri(lang, "فضای کاری هوشمند شما آماده است", "Your AI Business Workspace is ready", "Ihr KI-Arbeitsbereich ist bereit", "Yapay zeka çalışma alanınız hazır")}</h1><button onClick={goToDashboard} className="mt-6 px-5 py-2.5 rounded-xl text-white" style={{ background: "var(--primary)" }}>{tri(lang, "رفتن به داشبورد", "Go to dashboard", "Zum Dashboard", "Panele git")}</button></div>;
  return <div className="max-w-2xl mx-auto p-4 md:p-8" dir={lang === "fa" ? "rtl" : "ltr"}><div className="mb-8"><div className="flex items-center gap-3"><span className="w-10 h-10 rounded-xl grid place-items-center" style={{ background: "rgba(234,88,12,.15)", color: "var(--primary)" }}><Building2 /></span><div><h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{tri(lang, "افزودن کسب‌وکار", "Add a business", "Unternehmen hinzufügen", "İşletme ekle")}</h1><p className="text-sm" style={{ color: "var(--text-muted)" }}>{tri(lang, "مرحلهٔ " + step + " از ۳", "Step " + step + " of 3", "Schritt " + step + " von 3", "Adım " + step + " / 3")}</p></div></div><div className="h-1 rounded-full mt-5" style={{ background: "var(--surface-2)" }}><div className="h-full rounded-full" style={{ width: `${step / 3 * 100}%`, background: "var(--primary)" }} /></div></div>
    <div className="rounded-2xl p-5 md:p-6" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
      {step === 1 && <div className="space-y-4"><h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>{tri(lang, "هویت کسب‌وکار", "Business identity", "Unternehmensidentität", "İşletme kimliği")}</h2><label className="block text-sm">{tri(lang, "سازمان", "Organization", "Organisation", "Organizasyon")}<select value={form.organizationId} onChange={(e) => setForm({ ...form, organizationId: e.target.value })} className="mt-1 w-full p-3 rounded-xl" style={selectStyle}>{groups.map((group) => <option key={group.organization.id} value={group.organization.id}>{group.organization.name}</option>)}</select></label><label className="block text-sm">{tri(lang, "نام کسب‌وکار", "Business name", "Unternehmensname", "İşletme adı")}<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full p-3 rounded-xl" style={selectStyle} /></label><label className="block text-sm">{tri(lang, "صنعت", "Industry", "Branche", "Sektör")}<input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} className="mt-1 w-full p-3 rounded-xl" style={selectStyle} /></label><label className="block text-sm">{tri(lang, "زبان کاری کسب‌وکار", "Business working language", "Arbeitssprache des Unternehmens", "İşletmenin çalışma dili")}<select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} className="mt-1 w-full p-3 rounded-xl" style={selectStyle}>{LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}</select></label></div>}
      {step === 2 && <div className="space-y-4"><h2 className="font-semibold" style={{ color: "var(--text-primary)" }}>{tri(lang, "اطلاعات کسب‌وکار", "Business information", "Unternehmensinformationen", "İşletme bilgileri")}</h2><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={tri(lang, "این کسب‌وکار چه کاری انجام می‌دهد؟", "What does this business do?", "Was macht dieses Unternehmen?", "Bu işletme ne yapıyor?")} rows={4} className="w-full p-3 rounded-xl" style={selectStyle} /><div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="block text-xs">{tri(lang, "کشور", "Country", "Land", "Ülke")}<select value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} className="mt-1 w-full p-3 rounded-xl text-sm" style={selectStyle}><option value="">{tri(lang, "انتخاب کنید", "Select", "Auswählen", "Seçin")}</option>{COUNTRIES.map((c) => <option key={c.code} value={c.code}>{lang === "fa" ? c.fa : lang === "de" ? c.de : c.en}</option>)}</select></label>
        <label className="block text-xs">{tri(lang, "منطقهٔ زمانی", "Timezone", "Zeitzone", "Saat dilimi")}<select value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} className="mt-1 w-full p-3 rounded-xl text-sm" style={selectStyle}>{TIMEZONES.map((z) => <option key={z.value} value={z.value}>{z.label}</option>)}</select></label>
        <label className="block text-xs">{tri(lang, "واحد پول", "Currency", "Währung", "Para birimi")}<select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className="mt-1 w-full p-3 rounded-xl text-sm" style={selectStyle}>{CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} — {lang === "fa" ? c.fa : lang === "de" ? c.de : c.en}</option>)}</select></label>
      </div></div>}
      {step === 3 && <div><h2 className="font-semibold mb-1" style={{ color: "var(--text-primary)" }}>{tri(lang, "ماژول‌ها", "Modules", "Module", "Modüller")}</h2><p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>{tri(lang, "هر زمان از تنظیمات قابل تغییر است.", "You can change these later in settings.", "Sie können dies später ändern.", "Bunları daha sonra değiştirebilirsiniz.")}</p><div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{MODULES.map((module) => <button key={module} onClick={() => toggleModule(module)} className="text-start px-3 py-2.5 rounded-xl text-sm" style={{ background: form.modules.includes(module) ? "rgba(234,88,12,.16)" : "var(--surface-2)", border: `1px solid ${form.modules.includes(module) ? "var(--primary)" : "var(--border)"}` }}>{module}</button>)}</div></div>}
      <div className="flex justify-between mt-7"><button onClick={() => step === 1 ? router.back() : setStep((value) => value - 1)} className="px-4 py-2 rounded-xl text-sm" style={{ background: "var(--surface-2)" }}>{lang === "fa" ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}</button>{step < 3 ? <button onClick={next} className="px-4 py-2 rounded-xl text-sm text-white" style={{ background: "var(--primary)" }}>{tri(lang, "ادامه", "Continue", "Weiter", "Devam")}</button> : <button onClick={submit} disabled={saving} className="px-4 py-2 rounded-xl text-sm text-white flex gap-2 items-center" style={{ background: "var(--primary)" }}>{saving && <Loader2 className="w-4 h-4 animate-spin" />}{tri(lang, "ساخت کسب‌وکار", "Create business", "Unternehmen erstellen", "İşletme oluştur")}</button>}</div>
    </div></div>;
}
