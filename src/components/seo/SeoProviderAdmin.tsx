"use client";
import { useEffect, useState } from "react";
import { useTranslation, tri } from "@/lib/i18n";
import { Loader2, ShieldCheck, Search } from "lucide-react";
import toast from "react-hot-toast";
import type { SeoProviderConfig } from "@/lib/seo/intelligence/config";

type SafeConfig = Omit<SeoProviderConfig, "login" | "password"> & { configured: boolean };
type Job = { id: string; action: string; status: string; credits: number; actualCostUsd: number | null; errorCode: string | null; refundedAt: string | null };
export default function SeoProviderAdmin() {
  const { lang } = useTranslation();
  const text = (fa: string, en: string, de: string, tr: string) => tri(lang, fa, en, de, tr);
  const [config, setConfig] = useState<SafeConfig | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [login, setLogin] = useState(""); const [password, setPassword] = useState(""); const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const [probing, setProbing] = useState(false);
  const [connectionVerified, setConnectionVerified] = useState(false);
  const [loadingRates, setLoadingRates] = useState(false);
  useEffect(() => { fetch("/api/admin/seo-intelligence").then(async r => { if (!r.ok) throw Error(); return r.json(); }).then(d => { setConfig(d.config); setJobs(d.jobs); }).catch(() => setError(true)); }, []);
  const actions = { keywords: text("کلمات کلیدی", "Keywords", "Keywords", "Anahtar kelimeler"), rank: text("رتبه", "Rank", "Rang", "Sıralama"), competitors: text("رقبا", "Competitors", "Wettbewerber", "Rakipler"), backlinks: text("بک‌لینک", "Backlinks", "Backlinks", "Geri bağlantılar"), referringDomains: text("دامنه‌های ارجاع‌دهنده", "Referring domains", "Verweisende Domains", "Yönlendiren alan adları") };
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (!config) return; setSaving(true);
    try {
      const settings: Partial<SafeConfig> = { ...config }; delete settings.configured;
      const r = await fetch("/api/admin/seo-intelligence", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...settings, login, password }) });
      const d = await r.json(); if (!r.ok) throw Error(); setConfig(d.config); setConnectionVerified(false); setLogin(""); setPassword("");
      toast.success(text("تنظیمات ذخیره شد", "Settings saved", "Einstellungen gespeichert", "Ayarlar kaydedildi"));
    } catch { toast.error(text("تنظیمات را بررسی کنید؛ اتصال فعال به اطلاعات حساب نیاز دارد.", "Check settings; enabling requires account credentials.", "Einstellungen prüfen; Zugangsdaten sind erforderlich.", "Ayarları kontrol edin; hesap bilgileri gerekli.")); } finally { setSaving(false); }
  }
  const allActions = { ...actions, keywordGap: text("شکاف کلمات کلیدی", "Keyword gaps", "Keyword-Lücken", "Kelime boşlukları"), aiVisibility: text("شواهد جست‌وجوی AI", "AI search evidence", "KI-Suchnachweise", "AI arama kanıtları"), backlinkHistory: text("روند بک‌لینک", "Backlink history", "Backlink-Verlauf", "Geri bağlantı geçmişi") };
  const inputClass = "w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400";
  async function probe() {
    setProbing(true);
    try { const r = await fetch("/api/admin/seo-intelligence/probe", { method: "POST" }); if (!r.ok) throw Error(); setConnectionVerified(true); toast.success(text("اتصال حساب تأیید شد", "Account connection verified", "Kontoverbindung bestätigt", "Hesap bağlantısı doğrulandı")); }
    catch { toast.error(text("اتصال تأیید نشد؛ اطلاعات API و وضعیت حساب را بررسی کنید.", "Connection failed; check API credentials and account status.", "Verbindung fehlgeschlagen; API-Zugangsdaten und Kontostatus prüfen.", "Bağlantı başarısız; API bilgilerini ve hesap durumunu kontrol edin.")); }
    finally { setProbing(false); }
  }
  async function importRates() {
    setLoadingRates(true);
    try {
      const response = await fetch("/api/admin/seo-intelligence/rates", { method: "POST" });
      if (!response.ok) throw Error();
      const data = await response.json();
      setConfig(current => current ? { ...current, rates: data.rates } : current);
      toast.success(text("تعرفه‌های حساب دریافت شد؛ بررسی و ذخیره کنید.", "Account rates loaded. Review and save them.", "Kontopreise geladen. Prüfen und speichern.", "Hesap fiyatları alındı. İnceleyip kaydedin."));
    } catch { toast.error(text("تعرفه‌های حساب دریافت نشد؛ تنظیمات قبلی حفظ شد.", "Account rates unavailable. Existing settings were retained.", "Kontopreise nicht verfügbar. Einstellungen beibehalten.", "Hesap fiyatları alınamadı. Mevcut ayarlar korundu.")); }
    finally { setLoadingRates(false); }
  }
  if (!config) return <div role="status" className="p-8">{error ? text("تنظیمات در دسترس نیست؛ مهاجرت دیتابیس و دسترسی را بررسی کنید.", "Settings unavailable; check database migration and access.", "Einstellungen nicht verfügbar; Migration und Zugriff prüfen.", "Ayarlar kullanılamıyor; geçişi ve erişimi kontrol edin.") : <Loader2 className="animate-spin" />}</div>;
  return <main className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-8" dir={lang === "fa" ? "rtl" : "ltr"}>
    <header className="flex items-center gap-3"><Search className="text-orange-400" /><div><h1 className="text-2xl font-bold">SEO Intelligence</h1><p className="text-sm text-[var(--text-secondary)]">{text("اتصال امن، هزینه و اعتبار", "Secure connection, costs and credits", "Sichere Verbindung, Kosten und Credits", "Güvenli bağlantı, maliyet ve krediler")}</p></div></header>
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-1)] p-4 text-sm flex gap-3"><ShieldCheck className="shrink-0 text-orange-400" /><p>{text("اطلاعات حساب رمزگذاری می‌شود. خالی گذاشتن فیلدها، اطلاعات قبلی را نگه می‌دارد. قیمت‌ها را از حساب فعلی DataForSEO بررسی کنید؛ بدون تعرفه، درخواست پولی اجرا نمی‌شود.", "Credentials are encrypted. Leave fields blank to retain saved credentials. Confirm current DataForSEO account rates; paid requests require configured pricing.", "Zugangsdaten werden verschlüsselt. Leere Felder behalten gespeicherte Werte. Aktuelle DataForSEO-Preise bestätigen; kostenpflichtige Anfragen brauchen konfigurierte Preise.", "Hesap bilgileri şifrelenir. Boş alanlar kayıtlı bilgileri korur. Güncel DataForSEO fiyatlarını doğrulayın; ücretli istekler fiyat yapılandırması gerektirir.")}</p></div>
    <form onSubmit={save} className="space-y-6 rounded-2xl border border-[var(--border)] p-5">
      <label className="flex items-center gap-3"><input type="checkbox" checked={config.enabled} onChange={e => setConfig({ ...config, enabled: e.target.checked })} />{text("فعال کردن سرویس", "Enable service", "Dienst aktivieren", "Hizmeti etkinleştir")}</label>
      <p className="text-sm text-[var(--text-secondary)]">{connectionVerified ? text("اتصال API تأیید شد؛ دسترسی ابزارهای هزینه‌دار جداگانه بررسی می‌شود.", "API connection verified; paid tool access is checked separately.", "API-Verbindung bestätigt; kostenpflichtige Werkzeuge werden separat geprüft.", "API bağlantısı doğrulandı; ücretli araç erişimi ayrıca kontrol edilir.") : config.configured ? text("اطلاعات حساب ذخیره شده؛ اعتبار اتصال هنوز بررسی نشده است.", "Credentials saved; connection has not been verified.", "Zugangsdaten gespeichert; Verbindung noch nicht geprüft.", "Bilgiler kayıtlı; bağlantı henüz doğrulanmadı.") : text("اطلاعات حساب وارد نشده", "Credentials not configured", "Zugangsdaten fehlen", "Hesap bilgileri yapılandırılmadı")}</p>
      <div className="grid gap-4 sm:grid-cols-2"><label className="space-y-2 block"><span>DataForSEO API Login</span><input className={inputClass} autoComplete="off" value={login} onChange={e => setLogin(e.target.value)} /></label><label className="space-y-2 block"><span>DataForSEO API Password</span><input type="password" className={inputClass} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} /></label></div>
      <button type="button" disabled={!config.configured || probing} onClick={probe} className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-40">{probing ? <Loader2 className="animate-spin" /> : text("تست اتصال بدون درخواست پولی", "Test connection without paid task", "Verbindung ohne kostenpflichtigen Auftrag testen", "Ücretli işlem olmadan bağlantıyı test et")}</button>
      <div className="grid gap-4 sm:grid-cols-3">{([
        ["usdPerCredit", text("ارزش هر اعتبار (دلار)", "USD per credit", "USD pro Credit", "Kredi başına USD")],
        ["markupPercent", text("حاشیه قیمت (%)", "Markup (%)", "Aufschlag (%)", "Fiyat marjı (%)")],
        ["infrastructureUsd", text("هزینه زیرساخت هر اجرا (دلار)", "Infrastructure USD / run", "Infrastruktur USD / Lauf", "Altyapı USD / işlem")],
        ["maxRows", text("حداکثر نتایج", "Maximum results", "Maximale Ergebnisse", "Maksimum sonuç")],
        ["dailyCredits", text("بودجه روزانه هر کیف اعتبار", "Daily wallet credit budget", "Tägliches Wallet-Budget", "Günlük cüzdan kredi bütçesi")],
        ["maxConcurrent", text("حداکثر درخواست باز", "Maximum open jobs", "Maximale offene Aufträge", "Maksimum açık işler")],
        ["dailyJobs", text("حداکثر تلاش روزانه، شامل خطاها", "Daily attempts, including failures", "Tägliche Versuche, inklusive Fehler", "Hatalar dahil günlük deneme sayısı")],
      ] as const).map(([key, label]) => <label key={key} className="block space-y-2"><span className="text-sm">{label}</span><input type="number" min="0" step="any" required className={inputClass} value={config[key]} onChange={e => setConfig({ ...config, [key]: Number(e.target.value) })} /></label>)}</div>
      <fieldset className="space-y-3"><legend className="font-semibold mb-3">{text("تعرفه واقعی سرویس (دلار)", "Provider rates (USD)", "Anbieterpreise (USD)", "Sağlayıcı fiyatları (USD)")}</legend>
        <button type="button" disabled={!config.configured || loadingRates || saving} onClick={importRates} className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-40">{loadingRates ? <Loader2 className="animate-spin" /> : text("دریافت تعرفه‌های همین حساب · رایگان", "Load this account’s rates · Free", "Preise dieses Kontos laden · Kostenlos", "Bu hesabın fiyatlarını al · Ücretsiz")}</button>
        {Object.entries(allActions).map(([rawKey, label]) => { const key = rawKey as keyof typeof config.rates; const value = config.rates[key]; return <div key={key} className="grid gap-3 rounded-xl bg-[var(--surface-1)] p-3 sm:grid-cols-3"><label className="flex items-center gap-2"><input type="checkbox" checked={!!value} onChange={e => setConfig({ ...config, rates: { ...config.rates, [key]: e.target.checked ? { baseUsd: 0, rowUsd: 0 } : null } })} />{label}</label>{value && <><label className="text-xs space-y-1 block">{text("پایه هر درخواست", "Base / request", "Basis / Anfrage", "İstek başına taban")}<input type="number" step="0.000001" min="0" required className={inputClass} value={value.baseUsd} onChange={e => setConfig({ ...config, rates: { ...config.rates, [key]: { ...value, baseUsd: Number(e.target.value) } } })} /></label><label className="text-xs space-y-1 block">{text("هر نتیجه", "Per result", "Pro Ergebnis", "Sonuç başına")}<input type="number" step="0.000001" min="0" required className={inputClass} value={value.rowUsd} onChange={e => setConfig({ ...config, rates: { ...config.rates, [key]: { ...value, rowUsd: Number(e.target.value) } } })} /></label></>}</div>; })}
      </fieldset>
      <button disabled={saving} className="rounded-xl bg-orange-500 px-6 py-3 font-semibold text-black disabled:opacity-50">{saving ? <Loader2 className="animate-spin" /> : text("ذخیره تنظیمات", "Save settings", "Einstellungen speichern", "Ayarları kaydet")}</button>
    </form>
    <section><h2 className="mb-3 font-semibold">{text("درخواست‌ها و هزینه گزارش‌شده", "Jobs and reported expenses", "Aufträge und gemeldete Kosten", "İşler ve bildirilen maliyetler")}</h2><div className="space-y-2">{!jobs.length && <p className="text-sm text-[var(--text-secondary)]">{text("هنوز درخواستی ثبت نشده", "No jobs yet", "Noch keine Aufträge", "Henüz iş yok")}</p>}{jobs.map(job => <article key={job.id} className="rounded-xl border border-[var(--border)] p-3 flex flex-wrap gap-3 text-sm"><strong>{allActions[job.action as keyof typeof allActions] || job.action}</strong><span>{job.status === "QUEUED" ? text("در صف", "Queued", "In Warteschlange", "Sırada") : job.status === "RUNNING" ? text("در حال بررسی", "Running", "Wird ausgeführt", "Çalışıyor") : job.status === "SUCCEEDED" ? text("تکمیل شد", "Completed", "Abgeschlossen", "Tamamlandı") : text("ناموفق", "Failed", "Fehlgeschlagen", "Başarısız")}</span><span>{job.credits} {text("اعتبار", "credits", "Credits", "kredi")}</span><span>{job.actualCostUsd === null ? text("هزینه واقعی نامشخص", "Actual expense unknown", "Tatsächliche Kosten unbekannt", "Gerçek maliyet bilinmiyor") : `$${job.actualCostUsd}`}</span>{job.refundedAt && <span className="text-green-400">{text("اعتبار بازگردانده شد", "Credits refunded", "Credits erstattet", "Krediler iade edildi")}</span>}</article>)}</div></section>
  </main>;
}
