"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import { Bot, Users, Zap, Clock } from "lucide-react";

interface Stat { label: string; value: string; }

const ICONS = [Bot, Users, Zap, Clock];

const container: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const item: Variants = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.21, 0.47, 0.32, 0.98] } } };

export default function StatsBar({ stats }: { stats: Stat[] }) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto"
      variants={reduce ? undefined : container}
      initial={reduce ? undefined : "hidden"}
      whileInView={reduce ? undefined : "show"}
      viewport={{ once: true, margin: "-40px" }}
    >
      {stats.map((s, idx) => {
        const Icon = ICONS[idx];
        return (
          <motion.div
            key={s.label}
            variants={reduce ? undefined : item}
            className="flex flex-col items-center text-center p-5 rounded-2xl"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <Icon className="w-5 h-5 mb-2" style={{ color: "#ea580c" }} />
            <div className="text-xl font-bold text-white">{s.value}</div>
            <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>{s.label}</div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
