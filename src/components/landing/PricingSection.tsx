"use client";

import Link from "next/link";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { useState } from "react";
import { Check } from "lucide-react";
import { PERIOD_DISCOUNT, PERIOD_MONTHS } from "@/lib/payment/period";

interface PricingPlan {
  planCode: string;
  name: string;
  nameEn: string;
  price: number;
  priceUsd: number | null;
  credits: number;
  features: string[];
  isFeatured: boolean;
  color: string;
}

type BillingPeriod = "monthly" | "quarterly" | "semiannual" | "annual";
const BILLING_PERIODS: BillingPeriod[] = ["monthly", "quarterly", "semiannual", "annual"];

const container: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } };
const item: Variants     = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.21, 0.47, 0.32, 0.98] } } };

export default function PricingSection({
  plans, popularLabel, freeLabel, perMonth, startButton, viewAll, viewAllHref, lang, usdToTry,
}: {
  plans: PricingPlan[];
  popularLabel: string;
  freeLabel: string;
  perMonth: string;
  startButton: string;
  viewAll: string;
  viewAllHref: string;
  lang?: string;
  usdToTry?: number;
}) {
  const reduce = useReducedMotion();
  const isFa = lang === "fa";
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const months = PERIOD_MONTHS[period];
  const discount = PERIOD_DISCOUNT[period];
  const periodLabels: Record<BillingPeriod, string> = isFa
    ? { monthly: "ماهانه", quarterly: "۳ ماهه", semiannual: "۶ ماهه", annual: "سالانه" }
    : { monthly: "Monthly", quarterly: "3 months", semiannual: "6 months", annual: "Annual" };

  // Show max 3 plans on landing: Free, Plus, Pro
  const displayed = plans.slice(0, 3);

  return (
    <>
      <div className="flex flex-wrap justify-center gap-2 mb-7" aria-label={isFa ? "دورهٔ پرداخت" : "Billing period"}>
        {BILLING_PERIODS.map((option) => (
          <button key={option} type="button" onClick={() => setPeriod(option)}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors"
            style={{ background: period === option ? "#ea580c" : "rgba(255,255,255,0.07)", color: "white", border: "1px solid rgba(255,255,255,0.12)" }}>
            {periodLabels[option]}{PERIOD_DISCOUNT[option] > 0 ? ` · ${Math.round(PERIOD_DISCOUNT[option] * 100)}% ${isFa ? "تخفیف" : "off"}` : ""}
          </button>
        ))}
      </div>
      <motion.div
        className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto"
        variants={reduce ? undefined : container}
        initial={reduce ? undefined : "hidden"}
        whileInView={reduce ? undefined : "show"}
        viewport={{ once: true, margin: "-60px" }}
      >
        {displayed.map((p) => (
          <motion.div
            key={p.planCode}
            variants={reduce ? undefined : item}
            whileHover={reduce ? undefined : { y: -6 }}
            className="relative rounded-2xl p-6 flex flex-col"
            style={{
              background: p.isFeatured ? `${p.color}14` : "rgba(255,255,255,0.04)",
              border: p.isFeatured ? `1px solid ${p.color}66` : "1px solid rgba(255,255,255,0.08)",
            }}
          >
            {(() => {
              const base = isFa ? Math.round(p.price / 10) : (p.priceUsd || 0) / 100;
              const total = Math.round(base * months * (1 - discount) * 100) / 100;
              const perMonth = Math.round((total / months) * 100) / 100;
              const totalLabel = isFa ? `${total.toLocaleString("fa-IR")} تومان` : `$${total.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
              const monthlyLabel = isFa ? `${perMonth.toLocaleString("fa-IR")} تومان` : `$${perMonth.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
              return <>
            {p.isFeatured && (
              <div
                className="absolute -top-3 right-1/2 translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold text-white"
                style={{ background: p.color }}
              >
                {popularLabel}
              </div>
            )}
            <h3 className="font-bold text-lg mb-1 text-white">{lang === "fa" ? p.name : lang === "de" ? (p as any).nameDe || p.nameEn : p.nameEn}</h3>
            <div className="mb-4">
              {p.price > 0 || p.priceUsd ? <>
                <span className="text-3xl font-bold text-white">{totalLabel}</span>
                <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.55)" }}>
                  {isFa ? `پرداخت امروز برای ${periodLabels[period]} · معادل ${monthlyLabel} ${perMonth}` : `Due today for ${periodLabels[period]} · ${monthlyLabel} ${perMonth}`}
                </div>
              </> : <span className="text-3xl font-bold text-white">{freeLabel}</span>}
            </div>
            <ul className="space-y-2 mb-6 flex-1">
              {p.features.slice(0, 4).map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
                  <Check className="w-4 h-4 shrink-0" style={{ color: p.color }} />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href={p.planCode === "FREE" ? "/register" : `/register?plan=${p.planCode}&period=${period}`}
              className="block text-center py-3 rounded-xl font-semibold transition-all"
              style={
                p.isFeatured
                  ? { background: p.color, color: "white" }
                  : { background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", color: "white" }
              }
            >
              {startButton}
            </Link>
              </>;
            })()}
          </motion.div>
        ))}
      </motion.div>
      <div className="text-center mt-10">
        <Link href={viewAllHref} className="text-sm font-medium" style={{ color: "#ea580c" }}>
          {viewAll}
        </Link>
      </div>
    </>
  );
}
