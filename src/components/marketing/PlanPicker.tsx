"use client";
import Link from "next/link";
import { useState } from "react";
import { Check, ArrowUpRight } from "lucide-react";
import type { Lang } from "@/lib/i18n/server";
import type { PublicPlan } from "@/lib/marketing/data";
import { copy, text, type Copy } from "@/lib/marketing/catalog";
import { PERIOD_DISCOUNT, PERIOD_MONTHS, type BillingPeriod } from "@/lib/payment/period";
import { periodPrice } from "@/lib/marketing/pricing";

const labels: Record<BillingPeriod, Copy> = { monthly: ["ماهانه", "Monthly", "Monatlich", "Aylık"], quarterly: ["۳ ماهه", "3 months", "3 Monate", "3 aylık"], semiannual: ["۶ ماهه", "6 months", "6 Monate", "6 aylık"], annual: ["سالانه", "Annual", "Jährlich", "Yıllık"] };
const periods: BillingPeriod[] = ["monthly"];
export default function PlanPicker({ lang, plans, business }: { lang: Lang; plans: PublicPlan[] | null; business?: boolean }) {
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const format = (n: number) => lang === "fa" ? `${n.toLocaleString("fa-IR")} تومان` : new Intl.NumberFormat(lang === "de" ? "de-DE" : lang === "tr" ? "tr-TR" : "en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);
  if (!plans?.length) return <div className="m-empty"><p>{text(lang, copy.unavailable)}</p><Link className="m-button m-secondary" href="/contact">{text(lang, copy.contact)}</Link></div>;
  return <div>
    <div className="m-periods" role="group" aria-label={text(lang, copy.pricing)}>{periods.map(p => <button key={p} aria-pressed={period === p} onClick={() => setPeriod(p)}>{text(lang, labels[p])}{PERIOD_DISCOUNT[p] > 0 && <small>−{(PERIOD_DISCOUNT[p] * 100).toLocaleString(lang, { maximumFractionDigits: 1 })}%</small>}</button>)}</div>
    <div className={`m-plans ${business ? "m-business-plans" : ""}`}>
      {plans.map(p => { const total = p.price == null ? null : periodPrice(p.price, period, lang); return <article key={p.planCode} className={`m-plan ${p.featured ? "m-featured" : ""}`}>
        {p.featured && <span className="m-plan-label">{text(lang, ["پلن منتخب", "Featured plan", "Hervorgehobener Tarif", "Öne çıkan plan"])}</span>}
        <h3>{p.name}</h3><div className="m-price">{total == null ? text(lang, copy.contact) : total === 0 ? text(lang, ["رایگان", "Free", "Kostenlos", "Ücretsiz"]) : format(total)}</div>
        <p className="m-plan-period">{total != null && total > 0 ? `${text(lang, ["پرداخت برای", "Due for", "Zahlung für", "Dönem ödemesi:"])} ${text(lang, labels[period])}` : "\u00a0"}</p>
        {total != null && total > 0 && <p className="m-effective">{format(total / PERIOD_MONTHS[period])} / {text(lang, ["ماه، معادل", "month equivalent", "Monat, rechnerisch", "ay eşdeğeri"])}</p>}
        {p.planCode.startsWith("CRM_") ? <div className="m-plan-credit">{text(lang, ["دسترسی CRM مستقل از اشتراک AI است.", "CRM access is separate from your AI subscription.", "CRM-Zugriff ist unabhängig vom KI-Abo.", "CRM erişimi yapay zekâ aboneliğinden ayrıdır."])}</div> : <div className="m-plan-credit"><strong>{p.credits.toLocaleString(lang === "fa" ? "fa-IR" : lang)}</strong> {text(lang, copy.credits)}<small>{text(lang, ["اعتبار پایهٔ بسته؛ تخصیص نهایی در پرداخت", "Base package credits; final allocation at checkout", "Basis-Credits des Pakets; Zuteilung beim Checkout", "Paketin temel kredisi; son miktar ödeme adımında"])}</small></div>}
        {business && <p>{text(lang, p.planCode.startsWith("CRM_") ? ["ظرفیت CRM", "CRM capacity", "CRM-Kapazität", "CRM kapasitesi"] : ["ظرفیت تیم", "Team capacity", "Team-Kapazität", "Ekip kapasitesi"])}: {(p.planCode.startsWith("CRM_") ? p.crmSeats : p.teamSeats) ?? "—"}</p>}
        <ul>{p.features.map((f, i) => <li key={`${i}-${f}`}><Check size={15}/><span>{f}</span></li>)}</ul>
        <Link href={total == null ? "/contact" : p.planCode === "FREE" ? "/register" : `/plans?plan=${encodeURIComponent(p.planCode)}&period=${period}`} className={`m-button ${p.featured ? "" : "m-secondary"}`}>{text(lang, total == null ? copy.contact : copy.start)}<ArrowUpRight size={16}/></Link>
      </article>; })}
    </div>
    <p className="m-caption">{text(lang, ["قیمت‌ها از بسته‌های فعال خوانده می‌شوند؛ مبلغ نهایی و دسترسی‌ها در پرداخت تأیید می‌شوند. متن بسته‌های غیر فارسی مطابق نسخهٔ انگلیسی تنظیم‌شده توسط ادمین است.", "Prices come from active packages; final amount and access are confirmed at checkout. Package descriptions use the administrator's English copy outside Persian.", "Preise aus aktiven Paketen; Endbetrag und Zugriff werden beim Checkout bestätigt. Paketbeschreibungen außerhalb Persisch verwenden den englischen Admin-Text.", "Fiyatlar etkin paketlerden alınır; son tutar ve erişimler ödeme sırasında doğrulanır. Farsça dışındaki paket açıklamaları yöneticinin İngilizce metnini kullanır."])}</p>
  </div>;
}
