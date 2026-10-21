"use client";

import Link from "next/link";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { Stethoscope, Crown, Search, Smartphone, Globe, Users } from "lucide-react";

interface Feature { title: string; desc: string; href: string; }

const ICONS = [Stethoscope, Crown, Search, Smartphone, Globe, Users];
// Fixed categorical order, never cycled — each tool keeps its own colour so
// the grid reads as six distinct tools at a glance, not six orange tiles
// that only differ by their label.
const TILE_COLORS = ["#ea580c", "#a855f7", "#3b82f6", "#ec4899", "#1baf7a", "#f59e0b"];

const container: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const item: Variants = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.21, 0.47, 0.32, 0.98] } } };

export default function FeatureGrid({ features }: { features: Feature[] }) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
      variants={reduce ? undefined : container}
      initial={reduce ? undefined : "hidden"}
      whileInView={reduce ? undefined : "show"}
      viewport={{ once: true, margin: "-60px" }}
    >
      {features.map((f, idx) => {
        const Icon = ICONS[idx];
        const color = TILE_COLORS[idx % TILE_COLORS.length];
        return (
          <motion.div key={f.href} variants={reduce ? undefined : item} whileHover={reduce ? undefined : { y: -6 }} transition={{ duration: 0.25, ease: "easeOut" }}>
            <Link
              href={f.href}
              className="block p-5 rounded-2xl h-full transition-all group"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = `${color}4d`)}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}
            >
              <motion.div
                className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                style={{ background: `${color}26` }}
                whileHover={reduce ? undefined : { rotate: 10 }}
                transition={{ duration: 0.2 }}
              >
                <Icon className="w-5 h-5" style={{ color }} />
              </motion.div>
              <h3 className="font-bold mb-2">{f.title}</h3>
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>{f.desc}</p>
            </Link>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
