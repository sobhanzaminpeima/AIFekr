"use client";

import Link from "next/link";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { Check } from "lucide-react";

interface PricingPlan {
  planCode: string;
  name: string;
  price: number;
  credits: number;
  features: string[];
  isFeatured: boolean;
  color: string;
}

const container: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } };
const item: Variants = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.21, 0.47, 0.32, 0.98] } } };

export default function PricingSection({
  plans, popularLabel, freeLabel, perMonth, startButton, viewAll, viewAllHref,
}: {
  plans: PricingPlan[];
  popularLabel: string;
  freeLabel: string;
  perMonth: string;
  startButton: string;
  viewAll: string;
  viewAllHref: string;
}) {
  const reduce = useReducedMotion();

  return (
    <>
      <motion.div
        className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto"
        variants={reduce ? undefined : container}
        initial={reduce ? undefined : "hidden"}
        whileInView={reduce ? undefined : "show"}
        viewport={{ once: true, margin: "-60px" }}
      >
        {plans.map((p) => (
          <motion.div
            key={p.planCode}
            variants={reduce ? undefined : item}
            whileHover={reduce ? undefined : { y: -6 }}
            className="relative rounded-2xl p-6 flex flex-col"
            style={{
              background: p.isFeatured ? "rgba(234,88,12,0.08)" : "rgba(255,255,255,0.04)",
              border: p.isFeatured ? "1px solid rgba(234,88,12,0.4)" : "1px solid rgba(255,255,255,0.08)",
            }}
          >
            {p.isFeatured && (
              <div
                className="absolute -top-3 right-1/2 translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold text-white"
                style={{ background: "#ea580c" }}
              >
                {popularLabel}
              </div>
            )}
            <h3 className="font-bold text-lg mb-1">{p.name}</h3>
            <div className="mb-4">
              <span className="text-3xl font-bold text-white">
                {p.price > 0 ? p.price.toLocaleString("fa-IR") : freeLabel}
              </span>
              {p.price > 0 && <span className="text-sm mr-1" style={{ color: "rgba(255,255,255,0.5)" }}>{perMonth}</span>}
            </div>
            <ul className="space-y-2 mb-6 flex-1">
              {p.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
                  <Check className="w-4 h-4 shrink-0" style={{ color: p.color }} />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/register"
              className="block text-center py-3 rounded-xl font-semibold transition-all"
              style={
                p.isFeatured
                  ? { background: "linear-gradient(135deg, #ea580c, #f97316)", color: "white" }
                  : { background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", color: "white" }
              }
            >
              {startButton}
            </Link>
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
