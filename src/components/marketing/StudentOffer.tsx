"use client";
import Link from "@/components/marketing/PublicLink";
import { Check, GraduationCap } from "lucide-react";
import { STUDENT_PLAN_CODE, STUDENT_MONTHLY_CODE, STUDENT_OFFER, studentOfferCopy } from "@/lib/plans/studentOffer";
import { formatPackageAmount, packageAmount } from "@/lib/marketing/packageCurrency";
import type { Lang } from "@/lib/i18n/server";

export type StudentPackage = { planCode: string; price: number; priceUsd: number | null; credits: number; usdToTry?: number; rateDate?: string; isFallback?: boolean };
export default function StudentOffer({ lang, plan, onBuy, busy }: { lang: Lang; plan: StudentPackage | null; onBuy?: () => void; busy?: boolean }) {
  if (!plan || ![STUDENT_PLAN_CODE, STUDENT_MONTHLY_CODE].includes(plan.planCode)) return null;
  const introductory = plan.planCode === STUDENT_PLAN_CODE;
  const c = studentOfferCopy[lang];
  const usd = (plan.priceUsd ?? 0) / 100;
  const rates = { usdToToman: usd > 0 ? plan.price / 10 / usd : 0, usdToTry: plan.usdToTry ?? 49.123297 };
  const fmt = (value: number) => formatPackageAmount(packageAmount(value, lang, rates), lang);
  const amount = packageAmount(usd, lang, rates);
  return <section className="student-offer my-6 rounded-2xl border p-5 sm:p-6" style={{ borderColor: "var(--border)", background: "var(--surface-1, #16181d)", color: "var(--text-primary, #f4f5f8)" }} aria-label={c.title}>
    <div className="flex flex-wrap items-center justify-between gap-4"><h2 className="flex items-center gap-2 text-2xl font-bold"><GraduationCap aria-hidden size={28}/>{c.title}</h2></div>
    <div className="my-4 flex flex-wrap items-baseline gap-4" dir="ltr">{introductory && <del className="text-xl" style={{ color: "var(--text-muted)" }} aria-label={({fa:"قیمت عادی سه ماه",en:"Regular three-month price",de:"Regulärer Dreimonatspreis",tr:"Normal üç aylık fiyat"})[lang]}>{fmt(STUDENT_OFFER.originalUsdPrice)}</del>}<strong className="text-3xl">{fmt(usd)}</strong></div>
    <p>{introductory ? c.period : ({fa:"اشتراک عادی ماهانه",en:"Regular monthly subscription",de:"Reguläres Monatsabo",tr:"Normal aylık abonelik"})[lang]}</p>

    <ul className="my-4 grid gap-3 sm:grid-cols-2">{c.features.slice(0,4).map(f => <li key={f} className="flex items-start gap-2 text-sm"><Check size={17} className="shrink-0 text-orange-500" aria-hidden/><span>{f}</span></li>)}</ul>
    <details className="mb-4 text-sm"><summary className="cursor-pointer py-2">{({fa:"همهٔ امکانات دانشجویی",en:"All student features",de:"Alle Studierendenfunktionen",tr:"Tüm öğrenci özellikleri"})[lang]}</summary><ul className="my-3 grid gap-3 sm:grid-cols-2">{c.features.slice(4).map(f => <li key={f} className="flex items-start gap-2"><Check size={17} className="shrink-0 text-orange-500" aria-hidden/><span>{f}</span></li>)}</ul></details>
    <p className="mb-3 text-sm">{plan.credits > 0 && <strong>{plan.credits.toLocaleString(lang)} {({ fa: "کردیت برای کل دوره • ", en: "credits for the full term • ", de: "Credits für die gesamte Laufzeit • ", tr: "tüm dönem için kredi • " })[lang]}</strong>}{c.credit}</p>
    <p className="mb-3 text-xs opacity-80">{({ fa: "این خرید جایگزین اشتراک عمومی AI شما می‌شود؛ اشتراک CRM مستقل است. تمدید خودکار ندارد.", en: "This purchase replaces your general AI subscription; CRM is separate. No automatic renewal.", de: "Dieser Kauf ersetzt Ihr allgemeines KI-Abo; CRM bleibt separat. Keine automatische Verlängerung.", tr: "Bu satın alma genel yapay zekâ aboneliğinizin yerini alır; CRM ayrıdır. Otomatik yenileme yoktur." })[lang]}</p>
    <p className="mb-5 text-xs opacity-70">{c.rate} ({plan.rateDate || "2026-10-02"}) {plan.isFallback && ({fa:"نرخ ذخیره‌شده؛ دریافت نرخ زنده در دسترس نبود.",en:"Saved rate; live provider unavailable.",de:"Gespeicherter Kurs; Live-Anbieter nicht erreichbar.",tr:"Kayıtlı kur; canlı sağlayıcıya ulaşılamadı."})[lang]}</p>
    {introductory && !onBuy && <p className="mb-4"><Link href={`/register?plan=${STUDENT_MONTHLY_CODE}&period=monthly`} className="underline underline-offset-4">{({fa:"اشتراک عادی ماهانه",en:"Regular monthly subscription",de:"Reguläres Monatsabo",tr:"Normal aylık abonelik"})[lang]}</Link></p>}
    {onBuy ? <button disabled={busy || amount <= 0} onClick={onBuy} className="rounded-xl bg-orange-500 px-6 py-3 font-semibold text-black disabled:opacity-50">{busy ? "…" : c.buy}</button> : <Link className="m-button" href={`/register?plan=${plan.planCode}&period=monthly`}>{c.buy}</Link>}
  </section>;
}
