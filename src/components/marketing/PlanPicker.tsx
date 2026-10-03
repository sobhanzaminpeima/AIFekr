"use client";
import { isBusinessBundle } from "@/lib/plans/business";
import Link from "@/components/marketing/PublicLink";
import { useState } from "react";
import { Check, ArrowUpRight } from "lucide-react";
import type { Lang } from "@/lib/i18n/server";
import type { PublicPlan } from "@/lib/marketing/data";
import { copy, text } from "@/lib/marketing/catalog";
import { PERIOD_MONTHS, type BillingPeriod } from "@/lib/payment/period";
import { periodPrice } from "@/lib/marketing/pricing";
import BillingPeriods, { PERIOD_LABELS as labels } from "@/components/billing/BillingPeriods";
import type { FxRates } from "@/lib/utils/currency";

export default function PlanPicker({ lang, plans, business, rates, selection }: { lang: Lang; plans: PublicPlan[] | null; business?: boolean; rates?: FxRates; selection?: { period: BillingPeriod; currency: "USD" | "TRY" | "EUR"; setPeriod: (value: BillingPeriod) => void; setCurrency: (value: "USD" | "TRY" | "EUR") => void } }) {
  const [localPeriod, setLocalPeriod] = useState<BillingPeriod>("monthly");
  const [localCurrency, setLocalCurrency] = useState<"USD" | "TRY" | "EUR">("USD");
  const { period, currency, setPeriod, setCurrency } = selection ?? { period: localPeriod, currency: localCurrency, setPeriod: setLocalPeriod, setCurrency: setLocalCurrency };
  const multiplier = currency === "TRY" ? rates?.usdToTry ?? 1 : currency === "EUR" ? rates?.usdToEur ?? 1 : 1;
  const format = (n: number) => new Intl.NumberFormat(lang, { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
  if (!plans?.length) return <div className="m-empty"><p>{text(lang, copy.unavailable)}</p><Link className="m-button m-secondary" href="/contact">{text(lang, copy.contact)}</Link></div>;
  return <div>
    {plans.some(p => p.price != null && p.price > 0) && <div className="m-pricing-controls"><BillingPeriods lang={lang} value={period} onChange={setPeriod}/>{rates && <label>{text(lang, ["نمایش قیمت", "Display currency", "Preisanzeige", "Fiyat para birimi"])}<select value={currency} onChange={e => setCurrency(e.target.value as typeof currency)}><option value="USD">USD</option><option value="TRY">TRY · {text(lang, ["لیر", "Lira", "Lira", "Lira"])}</option><option value="EUR">EUR · {text(lang, ["یورو", "Euro", "Euro", "Euro"])}</option></select></label>}</div>}
    <div className={`m-plans ${business ? "m-business-plans" : ""} ${plans.some(p => isBusinessBundle(p.planCode)) ? "m-bundle-plans" : ""}`}>
      {plans.map(p => { const total = p.price == null ? null : periodPrice(p.price * multiplier, period, "en"); const bundle = isBusinessBundle(p.planCode); return <article key={p.planCode} className={`m-plan ${p.featured ? "m-featured" : ""}`}>
        {p.featured && <span className="m-plan-label">{text(lang, ["پلن منتخب", "Featured plan", "Hervorgehobener Tarif", "Öne çıkan plan"])}</span>}
        <h3>{p.name}</h3>{bundle && <p className="m-plan-fit">{text(lang, p.teamSeats && p.teamSeats <= 3 ? ["برای شروع یک کسب‌وکار کوچک", "For a small business getting started", "Für den Start eines kleinen Unternehmens", "Küçük işletmelerin başlangıcı için"] : p.teamSeats && p.teamSeats <= 10 ? ["برای تیم‌های در حال رشد", "For a growing team", "Für wachsende Teams", "Büyüyen ekipler için"] : ["برای حجم کار بیشتر", "For higher workloads", "Für mehr Arbeitsvolumen", "Daha yüksek iş yükleri için"])}</p>}<div className="m-price">{total == null ? text(lang, copy.contact) : total === 0 ? text(lang, ["رایگان", "Free", "Kostenlos", "Ücretsiz"]) : format(bundle ? total / PERIOD_MONTHS[period] : total)}{bundle && <small> / {text(lang, ["ماه", "month", "Monat", "ay"])}</small>}</div>
        <p className="m-plan-period">{total != null && total > 0 ? `${bundle ? format(total) + " · " : ""}${text(lang, ["پرداخت برای", "Due for", "Zahlung für", "Dönem ödemesi:"])} ${text(lang, labels[period])}` : "\u00a0"}</p>
        {!bundle && total != null && total > 0 && <p className="m-effective">{format(total / PERIOD_MONTHS[period])} / {text(lang, ["ماه، معادل", "month equivalent", "Monat, rechnerisch", "ay eşdeğeri"])}</p>}
        {p.planCode.startsWith("CRM_") ? <div className="m-plan-credit">{text(lang, ["دسترسی CRM مستقل از اشتراک AI است.", "CRM access is separate from your AI subscription.", "CRM-Zugriff ist unabhängig vom KI-Abo.", "CRM erişimi yapay zekâ aboneliğinden ayrıdır."])}</div> : <div className="m-plan-credit"><strong>{(p.credits * (bundle ? PERIOD_MONTHS[period] : 1)).toLocaleString(lang === "fa" ? "fa-IR" : lang)}</strong> {text(lang, copy.credits)}<small>{bundle ? text(lang, ["اعتبار کل دوره؛ مشترک بین همهٔ ابزارها", "Total term credits shared across all tools", "Credits für den Zeitraum, für alle Tools", "Dönem kredileri tüm araçlarda ortak"]) : text(lang, ["اعتبار پایهٔ بسته؛ تخصیص نهایی در پرداخت", "Base package credits; final allocation at checkout", "Basis-Credits des Pakets; Zuteilung beim Checkout", "Paketin temel kredisi; son miktar ödeme adımında"])}</small></div>}
        {business && (p.crmSeats != null || p.teamSeats != null) && <p>{text(lang, p.planCode.startsWith("CRM_") ? ["ظرفیت CRM", "CRM capacity", "CRM-Kapazität", "CRM kapasitesi"] : ["ظرفیت تیم", "Team capacity", "Team-Kapazität", "Ekip kapasitesi"])}: {((p.planCode.startsWith("CRM_") ? p.crmSeats : p.teamSeats) ?? 0).toLocaleString(lang)}</p>}
        <ul>{(bundle ? [text(lang, ["تمام امکانات بیزنس و CRM", "All business features and CRM", "Alle Geschäftsfunktionen und CRM", "Tüm işletme özellikleri ve CRM"]), text(lang, ["بدون خرید جداگانهٔ ماژول‌ها", "No separate module purchase", "Kein separater Modulkauf", "Ayrı modül satın alımı yok"])] : p.features.slice(0, 4)).map((f, i) => <li key={`${i}-${f}`}><Check size={15}/><span>{f}</span></li>)}</ul>
        {!bundle && p.features.length > 4 && <details className="m-plan-details"><summary>{text(lang, ["همهٔ امکانات", "All features", "Alle Funktionen", "Tüm özellikler"])} <span>+{p.features.length - 4}</span></summary><ul>{p.features.slice(4).map((f, i) => <li key={`${i}-${f}`}><Check size={15}/><span>{f}</span></li>)}</ul></details>}
        <Link href={total == null ? "/contact" : p.planCode === "FREE" ? "/register" : `/plans?plan=${encodeURIComponent(p.planCode)}&period=${period}&currency=${currency === "EUR" ? "EUR" : "TRY"}`} className={`m-button ${p.featured ? "" : "m-secondary"}`}>{text(lang, total == null ? copy.contact : ["انتخاب این پلن", "Choose this plan", "Tarif auswählen", "Bu paketi seç"])}<ArrowUpRight size={16}/></Link>
      </article>; })}
    </div>
    {rates && currency !== "USD" && <p className="m-caption">{text(lang, ["نرخ مرجع", "Reference rate", "Referenzkurs", "Referans kuru"])}: {rates.rateDate} · {text(lang, rates.isFallback ? ["نرخ جایگزین؛ مبلغ نهایی در پرداخت مشخص می‌شود.", "Fallback rate; final amount is confirmed at checkout.", "Ersatzkurs; Endbetrag beim Checkout.", "Yedek kur; son tutar ödeme adımında belirlenir."] : ["مبلغ نهایی در پرداخت تأیید می‌شود.", "Final amount confirmed at checkout.", "Endbetrag beim Checkout bestätigt.", "Son tutar ödeme adımında onaylanır."])}</p>}
    <p className="m-caption">{text(lang, ["استفاده از AI تا سقف اعتبار دوره است؛ هزینهٔ شماره تلفن، تماس و سرویس‌های بیرونی جداگانه است. تمدید خودکار نداریم.", "AI usage is capped by term credits. Phone numbers, calls and external service charges are separate. No automatic renewal.", "KI-Nutzung bis zum Credit-Limit. Telefonnummern, Anrufe und externe Dienste separat. Keine automatische Verlängerung.", "Yapay zekâ kullanımı dönem kredileriyle sınırlıdır. Telefon numarası, arama ve dış hizmet ücretleri ayrıdır. Otomatik yenileme yoktur."])}</p>
  </div>;
}
