"use client";

import Link from "next/link";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { Package } from "lucide-react";
import { formatPackPriceSync, type FxRates } from "@/lib/utils/currency";

interface Pack {
  id: string; slug: string; name: string; emoji: string; tagline: string;
  agents: string; tier: string; price: number; color: string; gradientFrom: string; gradientTo: string;
}

const container: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const item: Variants = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.21, 0.47, 0.32, 0.98] } } };

export default function PackGrid({ packs, agentsLabel, viewPack, lang = "en", fxRates }: { packs: Pack[]; agentsLabel: string; viewPack: string; lang?: "fa" | "en" | "de"; fxRates: FxRates }) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
      variants={reduce ? undefined : container}
      initial={reduce ? undefined : "hidden"}
      whileInView={reduce ? undefined : "show"}
      viewport={{ once: true, margin: "-60px" }}
    >
      {packs.map((pack) => {
        let agentCount = 0;
        try { agentCount = JSON.parse(pack.agents).length; } catch {}
        return (
          <motion.div key={pack.id} variants={reduce ? undefined : item} whileHover={reduce ? undefined : { y: -8 }} transition={{ duration: 0.25, ease: "easeOut" }}>
            <Link
              href={`/industry/${pack.slug}`}
              className="group block rounded-2xl overflow-hidden h-full transition-shadow duration-300"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 0 0 rgba(0,0,0,0)" }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 20px 40px -12px rgba(0,0,0,0.5)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 0 0 rgba(0,0,0,0)"; }}
            >
              <div className="p-5" style={{ background: `linear-gradient(135deg, ${pack.gradientFrom}aa, ${pack.gradientTo}aa)` }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.15)" }}>
                  <Package className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-bold mt-3 text-white">{pack.name}</h3>
                <p className="text-xs mt-1 text-white/70">{pack.tagline}</p>
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{agentCount} {agentsLabel}</span>
                  <span className="font-bold text-sm" style={{ color: pack.color }}>{formatPackPriceSync(pack.price, lang, fxRates)}</span>
                </div>
                <div className="mt-3 w-full py-1.5 rounded-lg text-xs font-medium text-center transition-all" style={{ background: `${pack.color}22`, color: pack.color }}>
                  {viewPack}
                </div>
              </div>
            </Link>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
