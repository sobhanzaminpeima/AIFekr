"use client";
import { useState } from "react";
import type { Lang } from "@/lib/i18n/server";
import type { PublicPlan } from "@/lib/marketing/data";
import type { FxRates } from "@/lib/utils/currency";
import { text, type Copy } from "@/lib/marketing/catalog";
import type { BillingPeriod } from "@/lib/payment/period";
import PlanPicker from "./PlanPicker";
import Link from "./PublicLink";
import StudentOffer, { type StudentPackage } from "./StudentOffer";

const groups = [
  { id: "team", label: ["کسب‌وکار", "Business", "Unternehmen", "İşletme"], prefix: "TEAM_BUSINESS_" },
  { id: "student", label: ["دانشجو", "Student", "Studierende", "Öğrenci"], prefix: "STUDENT_" },
] satisfies { id: string; label: Copy; prefix: string }[];

export default function PricingComparison({ lang, plans, rates, student }: { lang: Lang; plans: PublicPlan[] | null; rates: FxRates; student?: StudentPackage | null }) {
  const [selected, setSelected] = useState("team");
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  return <div className="m-pricing-comparison">{selected === "team" && <div className="business-pricing-intro"><h2>{text(lang, ["یک اشتراک؛ تیم کامل هوش مصنوعی", "One subscription. Your complete AI team", "Ein Abo. Ihr komplettes KI-Team", "Tek abonelik. Tam yapay zekâ ekibiniz"])}</h2><p>{text(lang, ["همهٔ پکیج‌های بیزنس امکانات یکسان دارند: مدیریت، فروش، CRM، مارکتینگ، سئو و حسابداری. فقط ظرفیت مصرف و تعداد اعضا فرق می‌کند.", "Every business package includes strategy, sales, CRM, marketing, SEO and accounting. Choose only your usage capacity and team size.", "Alle Geschäftspakete enthalten Strategie, Vertrieb, CRM, Marketing, SEO und Buchhaltung. Wählen Sie nur Verbrauchskapazität und Teamgröße.", "Tüm işletme paketleri strateji, satış, CRM, pazarlama, SEO ve muhasebeyi içerir. Yalnızca kullanım kapasitesi ve ekip büyüklüğünü seçin."])}</p></div>}
    <div className="m-pricing-groups" role="group" aria-label={text(lang, ["نوع اشتراک", "Subscription type", "Abonnementtyp", "Abonelik türü"])}>{groups.map(group => <button key={group.id} aria-pressed={selected === group.id} onClick={() => setSelected(group.id)}>{text(lang, group.label)}</button>)}</div>
    {groups.map(group => <div key={group.id} hidden={selected !== group.id}>{group.id === "student" && student ? <StudentOffer lang={lang} plan={student}/> : <PlanPicker lang={lang} plans={plans?.filter(plan => plan.planCode.startsWith(group.prefix)) ?? null} business={group.id !== "student"} rates={rates} selection={{ period, setPeriod }}/>}</div>)}
    <div className="m-free-start"><div><strong>{text(lang, ["می‌خواهید اول امتحان کنید؟", "Want to try first?", "Zuerst ausprobieren?", "Önce denemek ister misiniz?"])}</strong><p>{text(lang, ["حساب رایگان بسازید؛ برای شروع نیازی به پرداخت نیست.", "Create a free account and explore your available tools. No payment needed to start.", "Kostenloses Konto erstellen und Tools entdecken. Zum Start ist keine Zahlung nötig.", "Ücretsiz hesap açıp araçları keşfedin. Başlamak için ödeme gerekmez."])}</p></div><Link href="/register" className="m-button m-secondary">{text(lang, ["شروع رایگان", "Start free", "Kostenlos starten", "Ücretsiz başla"])}</Link></div>
  </div>;
}
