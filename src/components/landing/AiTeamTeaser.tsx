"use client";

import Link from "next/link";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { Lightbulb, Target, Search, PenLine, ClipboardCheck, Globe2, Send, Eye, Crown, ArrowLeft } from "lucide-react";

const AGENT_ICONS = [Lightbulb, Target, Search, PenLine, ClipboardCheck, Globe2, Send, Eye];

const container: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.35 } } };
const item: Variants = { hidden: { opacity: 0, scale: 0.7 }, show: { opacity: 1, scale: 1, transition: { duration: 0.35, ease: "backOut" } } };

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 36, scale: 0.94 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.7, ease: [0.21, 0.47, 0.32, 0.98] } },
};

export default function AiTeamTeaser({
  eyebrow, title, desc, agentNames, ctaLabel, ctaHref,
}: {
  eyebrow: string; title: string; desc: string; agentNames: string[]; ctaLabel: string; ctaHref: string;
}) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      initial={reduce ? undefined : "hidden"}
      whileInView={reduce ? undefined : "show"}
      viewport={{ once: true, margin: "-80px" }}
      variants={reduce ? undefined : cardVariants}
      className="relative rounded-3xl p-8 md:p-12 overflow-hidden"
      style={{ background: "linear-gradient(135deg, rgba(234,88,12,0.12), rgba(139,92,246,0.08))", border: "1px solid rgba(234,88,12,0.25)" }}
    >
      {!reduce && (
        <motion.div
          className="pointer-events-none absolute -inset-px rounded-3xl -z-10"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: [0, 0.9, 0] }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 1.4, delay: 0.15, ease: "easeOut" }}
          style={{ background: "linear-gradient(135deg, rgba(234,88,12,0.5), rgba(139,92,246,0.35))", filter: "blur(18px)" }}
        />
      )}
      <div className="relative max-w-3xl mx-auto text-center">
        <motion.div
          initial={reduce ? undefined : { opacity: 0, y: 12 }}
          whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.45, delay: 0.05 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium mb-5"
          style={{ background: "rgba(234,88,12,0.15)", color: "#f97316" }}
        >
          <Crown className="w-3.5 h-3.5" /> {eyebrow}
        </motion.div>
        <motion.h2
          initial={reduce ? undefined : { opacity: 0, y: 14 }}
          whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, delay: 0.12 }}
          className="text-2xl md:text-4xl font-bold mb-4"
        >
          {title}
        </motion.h2>
        <motion.p
          initial={reduce ? undefined : { opacity: 0, y: 14 }}
          whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, delay: 0.18 }}
          className="text-base md:text-lg mb-10"
          style={{ color: "rgba(255,255,255,0.6)" }}
        >
          {desc}
        </motion.p>

        <motion.div
          className="flex items-center justify-center flex-wrap gap-3 mb-10"
          variants={reduce ? undefined : container}
          initial={reduce ? undefined : "hidden"}
          whileInView={reduce ? undefined : "show"}
          viewport={{ once: true, margin: "-60px" }}
        >
          {agentNames.map((name, idx) => {
            const Icon = AGENT_ICONS[idx % AGENT_ICONS.length];
            return (
              <motion.div key={name} variants={reduce ? undefined : item} className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                  <Icon className="w-5 h-5" style={{ color: "#ea580c" }} />
                </div>
                <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.5)" }}>{name}</span>
              </motion.div>
            );
          })}
        </motion.div>

        <motion.div whileHover={reduce ? undefined : { scale: 1.03 }} whileTap={reduce ? undefined : { scale: 0.98 }} className="inline-block">
          <Link
            href={ctaHref}
            className="flex items-center gap-2 px-8 py-4 rounded-2xl text-white font-semibold text-lg"
            style={{ background: "linear-gradient(135deg, #ea580c, #f97316)", boxShadow: "0 8px 30px rgba(234,88,12,0.25)" }}
          >
            {ctaLabel}
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </motion.div>
      </div>
    </motion.div>
  );
}
