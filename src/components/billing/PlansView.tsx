"use client";

import BusinessPackageFeatures from "./BusinessPackageFeatures";
import type { FxRates } from "@/lib/utils/currency";
import { isBusinessBundle } from "@/lib/plans/business";
import { useState, useEffect, useCallback } from "react";
import { ArrowUpRight, Building2, GraduationCap, ShieldCheck, RefreshCw, Check } from "lucide-react";
import { useTranslation, tri } from "@/lib/i18n";
import BillingPeriods, { PURCHASE_PERIODS, PERIOD_LABELS } from "./BillingPeriods";
import { text } from "@/lib/marketing/catalog";
import { parseFeatures } from "@/lib/marketing/features";
import { packageAmount, formatPackageAmount } from "@/lib/marketing/packageCurrency";
import { periodPrice } from "@/lib/marketing/pricing";
import { PERIOD_MONTHS, type BillingPeriod } from "@/lib/payment/period";
import { isStudentIntroPlan, STUDENT_OFFER } from "@/lib/plans/studentOffer";

type Package = { planCode: string; name: string; nameEn: string; price: number; priceUsd: number | null; duration: number; credits: number; isFeatured: boolean; features: string | null; featuresEn: string | null; teamSeatLimit:number | null };

export default function PlansView() {
  const { lang } = useTranslation();
  const [accountType,setAccountType] = useState("");
  const [selectStudentAccount,setSelectStudentAccount] = useState(false);
  useEffect(()=>{fetch("/api/auth/me",{credentials:"include"}).then(r=>r.ok?r.json():null).then(d=>setAccountType(d?.user?.accountType||"PERSONAL")).catch(()=>setAccountType("PERSONAL"));},[]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [rates, setRates] = useState<FxRates | null>(null);
  const [audience, setAudience] = useState("business");
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const [currency, setCurrency] = useState("TRY");
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("");
  const t = useCallback((a: string, b: string, c: string, d: string) => tri(lang, a, b, c, d), [lang]);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const requestedPeriod = query.get("period") as BillingPeriod;
    if (PURCHASE_PERIODS.includes(requestedPeriod)) setPeriod(requestedPeriod);
    const requestedPlan = query.get("plan") || "";
    if (["EUR", "TRY"].includes(query.get("currency") || "")) setCurrency(query.get("currency")!);
    setSelectedPlan(requestedPlan);
    if (requestedPlan.startsWith("STUDENT_")) setAudience("students");
    else if (requestedPlan.startsWith("CRM_")) setAudience("crm");
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/packages");
      if (!response.ok) throw new Error();
      const data = await response.json();
      setPackages(data.packages || []);
      setRates(data.fxRates || null);
    } catch {
      setError(t("دریافت پلن‌ها ممکن نشد. دوباره تلاش کنید.", "Unable to load plans. Please retry.", "Tarife konnten nicht geladen werden. Bitte erneut versuchen.", "Paketler yüklenemedi. Lütfen tekrar deneyin."));
    } finally { setLoading(false); }
  }, [t]);
  useEffect(() => { void load(); }, [load]);

  async function buy(code: string) {
    if(code.startsWith("STUDENT_")&&accountType!=="STUDENT"&&!selectStudentAccount){setError(t("برای ادامه، حساب دانشجویی را برای همین حساب انتخاب کنید.","Select student account for your existing account to continue.","Wählen Sie für Ihr bestehendes Konto das Studierendenkonto.","Devam etmek için mevcut hesabınızda öğrenci hesabını seçin."));return;}
    setBusy(code); setError("");
    try {
      const response = await fetch("/api/payment/create", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: code, period: code.startsWith("STUDENT_") ? "monthly" : period, currency, ...(code.startsWith("STUDENT_") ? {selectStudentAccount:accountType==="STUDENT"||selectStudentAccount} : {}) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      window.location.href = data.paymentUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : t("پرداخت ایجاد نشد", "Unable to create payment", "Zahlung nicht erstellt", "Ödeme oluşturulamadı"));
      setBusy("");
    }
  }

  const visible = packages.filter(p => audience === "students" ? p.planCode.startsWith("STUDENT_") : audience === "crm" ? p.planCode.startsWith("CRM_") : isBusinessBundle(p.planCode)).sort((a,b) => Number(isStudentIntroPlan(b.planCode)) - Number(isStudentIntroPlan(a.planCode)));
  const format = (amount: number, usd: boolean) => formatPackageAmount(
    packageAmount(usd ? amount : amount / (rates?.usdToToman ?? 163399.625272), lang, rates ?? undefined), lang);


  return <div className="workspace-page billing-page" dir={lang === "fa" ? "rtl" : "ltr"}>
    <header className="workspace-heading"><span className="workspace-eyebrow">AIFekr / {t("اشتراک", "Membership", "Abonnement", "Abonelik")}</span>
      <h1>{t("پلن مناسب شما", "A plan that fits you", "Der passende Tarif", "Size uygun paket")}</h1>
      <p>{t("یک خرید برای تیم کامل AI، CRM و همهٔ ابزارهای بیزنس؛ فقط ظرفیت و تعداد اعضا را انتخاب کنید.", "One purchase for your complete AI team, CRM and business tools. Choose only capacity and team size.", "Ein Kauf für KI-Team, CRM und Geschäftstools. Wählen Sie Kapazität und Teamgröße.", "Tam yapay zekâ ekibi, CRM ve işletme araçları tek satın alımda. Kapasite ve ekip büyüklüğünü seçin.")}</p>
    </header>
    <div className="billing-toolbar">
      <div className="billing-audience" role="group" aria-label={t("نوع پلن", "Plan type", "Tariftyp", "Paket türü")}>
        <button disabled={!!busy} aria-pressed={audience === "business"} onClick={() => setAudience("business")}><Building2 size={17}/>{t("کسب‌وکار", "Business", "Unternehmen", "İşletme")}</button>
        <button disabled={!!busy} aria-pressed={audience === "students"} onClick={() => setAudience("students")}><GraduationCap size={18}/>{t("دانشجو", "Students", "Studierende", "Öğrenciler")}</button>
      </div>
      {audience !== "students" && <BillingPeriods lang={lang} value={period} onChange={setPeriod} disabled={!!busy}/>}
      <label className="billing-currency">{t("ارز پرداخت", "Pay in", "Zahlungswährung", "Ödeme para birimi")}<select disabled={!!busy} value={currency} onChange={e => setCurrency(e.target.value)}><option value="TRY">TRY</option><option value="EUR">EUR</option></select></label>
    </div>
    {audience === "students" && accountType !== "STUDENT" && <label className="my-4 flex items-start gap-3 rounded-2xl border p-4" style={{borderColor:"var(--border)"}}><input type="checkbox" checked={selectStudentAccount} onChange={e=>setSelectStudentAccount(e.target.checked)} className="mt-1 accent-orange-500"/><span><strong>{t("همین حساب را برای فضای دانشجویی انتخاب می‌کنم","Use my existing account as a student account","Mein bestehendes Konto als Studierendenkonto verwenden","Mevcut hesabımı öğrenci hesabı olarak kullan")}</strong><span className="mt-2 block text-sm opacity-75">{t("نیازی به ثبت‌نام دوباره نیست. پس از تأیید پرداخت، حساب شما در دستهٔ دانشجویان قرار می‌گیرد و ایجنت دانشجویی در دانشگاه/مدرسه فعال می‌شود.","No new registration. After payment approval, your account is classified as student and the Student Agent activates in University / School.","Keine erneute Registrierung. Nach Zahlungsbestätigung wird Ihr Konto als Studierendenkonto geführt und der Lernagent aktiviert.","Yeniden kayıt gerekmez. Ödeme onayından sonra hesabın öğrenci olarak sınıflandırılır ve Üniversite / Okul öğrenci ajanı etkinleşir.")}</span></span></label>}
    {audience === "students" && <p className="billing-note">{t("این خرید جایگزین اشتراک عمومی AI شما می‌شود؛ CRM مستقل است. حساب، گفتگوها و فایل‌های شما باقی می‌مانند.","This replaces your general AI subscription; CRM is separate. Your account, chats and files remain.","Dieser Kauf ersetzt Ihr allgemeines KI-Abo; CRM bleibt separat. Konto, Chats und Dateien bleiben erhalten.","Bu satın alma genel AI aboneliğinin yerini alır; CRM ayrıdır. Hesabın, sohbetlerin ve dosyaların korunur.")}</p>}
    <p className="billing-note"><ShieldCheck size={17}/>{currency === "EUR" ? t("پرداخت یورو از حساب زراعت‌بانک بدون کمیسیون است. مبلغ نهایی در مرحله بعد؛ فعال‌سازی پس از تأیید رسید.", "Euro payments from a Ziraat Bank account are commission-free. Final amount at checkout; activation after receipt approval.", "Euro-Zahlungen vom Ziraat-Konto sind provisionsfrei. Endbetrag beim Checkout; Aktivierung nach Belegfreigabe.", "Ziraat Bankası hesabından euro ödemesi komisyonsuzdur. Son tutar ödeme adımında; dekont onayından sonra etkinleştirme.") : t("پرداخت بانکی با رسید؛ مبلغ نهایی در مرحله بعد و فعال‌سازی پس از تأیید ادمین.", "Bank transfer with receipt. Final amount at checkout; activation after admin approval.", "Überweisung mit Beleg. Endbetrag beim Checkout; Aktivierung nach Admin-Freigabe.", "Dekont ile havale. Son tutar ödeme adımında; yönetici onayından sonra etkinleştirme.")}</p>
    {rates && <p className="billing-note">{t("نرخ مرجع", "Reference rate", "Referenzkurs", "Referans kuru")}: {rates.rateDate} · {t("مبلغ دقیق در پرداخت تأیید می‌شود. شماره تلفن، تماس و سرویس‌های بیرونی هزینهٔ جدا دارند.", "Exact amount confirmed at checkout. Phone numbers, calls and external services have separate charges.", "Endbetrag beim Checkout. Telefonnummern, Anrufe und externe Dienste separat.", "Son tutar ödeme adımında doğrulanır. Telefon numarası, arama ve dış hizmet ücretleri ayrıdır.")}</p>}
    {error && <div className="workspace-alert" role="alert">{error}{!packages.length && <button className="workspace-button secondary" onClick={() => void load()}><RefreshCw size={16}/>{t("تلاش مجدد", "Retry", "Erneut versuchen", "Tekrar dene")}</button>}</div>}
    {loading ? <div className="billing-grid" aria-busy="true" aria-label={t("در حال دریافت پلن‌ها", "Loading plans", "Tarife werden geladen", "Paketler yükleniyor")}>{[1,2,3].map(i => <div key={i} className="skeleton h-80 rounded-2xl"/>)}</div>
      : <div className="billing-grid">{visible.map(p => {
        const bundle = isBusinessBundle(p.planCode);
        const student = p.planCode.startsWith("STUDENT_");
        const introductory = isStudentIntroPlan(p.planCode);
        const term = student ? "monthly" : period;
        const usd = p.priceUsd != null;
        const total = periodPrice(usd ? p.priceUsd! / 100 : Math.round(p.price / 10), term, usd ? "en" : "fa");
        const features = parseFeatures(lang === "fa" ? p.features : p.featuresEn || p.features);
        return <article key={p.planCode} className={`billing-plan ${p.isFeatured || selectedPlan === p.planCode ? "featured" : ""}`}>
          <div className="billing-plan-top"><span className="workspace-eyebrow">{student ? "STUDENT" : p.planCode.startsWith("CRM_") ? "CRM" : "TEAM AI"}</span>{p.isFeatured && <span className="billing-badge">{t("پیشنهادی", "Recommended", "Empfohlen", "Önerilen")}</span>}</div>
          <h2>{introductory ? t("پکیج دانشجویی سه‌ماهه", "Three-month student package", "Studierendenpaket für drei Monate", "Üç aylık öğrenci paketi") : lang === "fa" ? p.name : p.nameEn || p.name}</h2>
          <p className="billing-plan-purpose">{student ? t("فضای مطالعه و ابزارهای هوشمند", "Study workspace and AI tools", "Lernbereich und KI-Werkzeuge", "Çalışma alanı ve yapay zekâ araçları") : p.planCode.startsWith("CRM_") ? t("مدیریت مشتری؛ اعتبار AI جداگانه", "Customer management; AI credits separate", "Kundenverwaltung; KI-Credits separat", "Müşteri yönetimi; yapay zekâ kredileri ayrı") : t("تیم کامل AI و CRM در یک اشتراک", "Complete AI team and CRM in one subscription", "Team-Abo mit gemeinsamen KI-Credits", "Ortak yapay zekâ kredili ekip aboneliği")}</p>
          {introductory && <p className="billing-effective"><del>{format(STUDENT_OFFER.originalUsdPrice, true)}</del></p>}
          <div className="billing-price">{format(bundle ? total / PERIOD_MONTHS[period] : total, usd)}{bundle && <small> / {t("ماه", "month", "Monat", "ay")}</small>}</div>
          <p className="billing-price-caption">{bundle ? `${format(total, usd)} · ${text(lang, PERIOD_LABELS[period])}` : introductory ? t("۳ ماه (۹۰ روز)", "3 months (90 days)", "3 Monate (90 Tage)", "3 ay (90 gün)") : text(lang, PERIOD_LABELS[term])} · {t("مبلغ کل دوره", "total for the term", "Gesamtbetrag", "dönem toplamı")}</p>
          {!bundle && !introductory && term !== "monthly" && <p className="billing-effective">{format(total / PERIOD_MONTHS[term], usd)} / {t("ماه", "month", "Monat", "ay")}</p>}
          {!p.planCode.startsWith("CRM_") && <p className="billing-credits"><strong>{(p.credits * (bundle ? PERIOD_MONTHS[period] : 1)).toLocaleString(lang)}</strong> {t("اعتبار کل دوره", "term credits", "Credits im Zeitraum", "dönem kredisi")}</p>}
          {bundle && <p>{t("تعداد اعضا", "Team members", "Teammitglieder", "Ekip üyesi")}: {p.teamSeatLimit}</p>}
          {bundle ? <BusinessPackageFeatures lang={lang} planCode={p.planCode}/> : <ul className="billing-features">{features.slice(0,3).map(f => <li key={f}><Check size={15}/>{f}</li>)}</ul>}
          {!bundle && features.length > 3 && <details className="billing-details"><summary>{t("همهٔ امکانات", "All features", "Alle Funktionen", "Tüm özellikler")}</summary><ul className="billing-features">{features.slice(3).map(f => <li key={f}><Check size={15}/>{f}</li>)}</ul></details>}
          <button disabled={!!busy || total <= 0} onClick={() => void buy(p.planCode)} className="workspace-button billing-buy">{busy === p.planCode ? t("در حال آماده‌سازی…", "Preparing…", "Wird vorbereitet…", "Hazırlanıyor…") : t("ادامه و پرداخت", "Continue to payment", "Weiter zur Zahlung", "Ödemeye devam")}<ArrowUpRight size={17}/></button>
        </article>;
      })}</div>}
    <details className="billing-details"><summary>{t("فقط CRM نیاز دارید؟", "Only need CRM?", "Nur CRM benötigt?", "Yalnızca CRM mi gerekli?")}</summary><button className="workspace-button secondary" onClick={() => setAudience("crm")}>{t("نمایش اشتراک مستقل CRM", "Show standalone CRM plans", "Separate CRM-Tarife anzeigen", "Bağımsız CRM paketlerini göster")}</button></details>
    {!loading && !error && !visible.length && <div className="workspace-empty">{t("فعلاً پلنی برای این بخش موجود نیست؛ گروه دیگری را انتخاب کنید.", "No plans available here yet. Choose another group.", "Hier sind derzeit keine Tarife verfügbar. Wählen Sie eine andere Gruppe.", "Bu grupta henüz paket yok. Başka bir grup seçin.")}</div>}
  </div>;
}
