"use client";

import Link from "next/link";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import {
  Crown, Lightbulb, Target, Search, PenLine, ClipboardCheck, Globe2, Send, Eye,
  RefreshCw, Brain, Database, TrendingUp, MessageCircle, Clock,
  Stethoscope, ListChecks, CalendarCheck, Gauge,
} from "lucide-react";

const AGENT_ICONS = [Lightbulb, Target, Search, PenLine, ClipboardCheck, Globe2, Send, Eye];
const CEO_ICONS = [Database, TrendingUp, MessageCircle, Clock];
const DOCTOR_ICONS = [ListChecks, Stethoscope, CalendarCheck, Gauge];

interface Strings {
  heroEyebrow: string; heroTitle: string; heroDesc: string; heroCta: string;
  pipelineTitle: string; pipelineDesc: string;
  agents: { title: string; desc: string }[];
  loopTitle: string; loopDesc: string;
  memoryTitle: string; memoryDesc: string;
  doctorEyebrow: string; doctorTitle: string; doctorDesc: string;
  doctorFeatures: { title: string; desc: string }[];
  ceoTitle: string; ceoDesc: string;
  ceoFeatures: { title: string; desc: string }[];
  finalCtaTitle: string; finalCtaDesc: string; finalCtaButton: string;
}

const container: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const item: Variants = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.21, 0.47, 0.32, 0.98] } } };

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? undefined : { opacity: 0, y: 20 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.4, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
    >
      {children}
    </motion.div>
  );
}

export default function AiTeamPipeline({ s }: { s: Strings }) {
  const reduce = useReducedMotion();

  return (
    <>
      {/* Hero */}
      <section className="pt-20 pb-16 px-6 text-center relative overflow-hidden">
        <div
          className="absolute inset-0 -z-10"
          style={{ background: "radial-gradient(ellipse at top, rgba(234,88,12,0.15), transparent 60%)" }}
        />
        <Reveal>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm mb-6" style={{ background: "rgba(234,88,12,0.15)", border: "1px solid rgba(234,88,12,0.3)", color: "#ea580c" }}>
            <Crown className="w-4 h-4" /> {s.heroEyebrow}
          </div>
          <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight max-w-4xl mx-auto">{s.heroTitle}</h1>
          <p className="text-lg md:text-xl mb-10 max-w-2xl mx-auto" style={{ color: "rgba(255,255,255,0.6)", lineHeight: 1.8 }}>{s.heroDesc}</p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl text-white font-semibold text-lg"
            style={{ background: "linear-gradient(135deg, #ea580c, #f97316)", boxShadow: "0 8px 30px rgba(234,88,12,0.25)" }}
          >
            {s.heroCta}
          </Link>
        </Reveal>
      </section>

      {/* 8-agent pipeline */}
      <section className="py-16 px-6" style={{ background: "rgba(255,255,255,0.02)" }}>
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <h2 className="text-3xl font-bold text-center mb-3">{s.pipelineTitle}</h2>
            <p className="text-center mb-14 max-w-2xl mx-auto" style={{ color: "rgba(255,255,255,0.5)" }}>{s.pipelineDesc}</p>
          </Reveal>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-4 gap-x-4 gap-y-8"
            variants={reduce ? undefined : container}
            initial={reduce ? undefined : "hidden"}
            whileInView={reduce ? undefined : "show"}
            viewport={{ once: true, margin: "-60px" }}
          >
            {s.agents.map((a, idx) => {
              const Icon = AGENT_ICONS[idx];
              return (
                <motion.div key={a.title} variants={reduce ? undefined : item} className="relative">
                  <div
                    className="rounded-2xl p-5 h-full"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(234,88,12,0.15)" }}>
                        <Icon className="w-4 h-4" style={{ color: "#ea580c" }} />
                      </div>
                      <span className="text-xs font-bold" style={{ color: "#ea580c" }}>{idx + 1}</span>
                    </div>
                    <h3 className="font-bold mb-1.5">{a.title}</h3>
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>{a.desc}</p>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* Feedback loop + memory */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-5">
          <Reveal>
            <div className="rounded-2xl p-6 h-full" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-4" style={{ background: "rgba(234,88,12,0.15)" }}>
                <RefreshCw className="w-5 h-5" style={{ color: "#ea580c" }} />
              </div>
              <h3 className="font-bold text-lg mb-2">{s.loopTitle}</h3>
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>{s.loopDesc}</p>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="rounded-2xl p-6 h-full" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-4" style={{ background: "rgba(139,92,246,0.15)" }}>
                <Brain className="w-5 h-5" style={{ color: "#8b5cf6" }} />
              </div>
              <h3 className="font-bold text-lg mb-2">{s.memoryTitle}</h3>
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>{s.memoryDesc}</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Business Doctor */}
      <section className="py-16 px-6" style={{ background: "rgba(255,255,255,0.02)" }}>
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-4" style={{ background: "rgba(59,130,246,0.15)", color: "#3b82f6" }}>
              <Stethoscope className="w-3.5 h-3.5" /> {s.doctorEyebrow}
            </div>
            <h2 className="text-3xl font-bold mb-3">{s.doctorTitle}</h2>
            <p className="mb-10 max-w-2xl" style={{ color: "rgba(255,255,255,0.5)" }}>{s.doctorDesc}</p>
          </Reveal>

          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
            variants={reduce ? undefined : container}
            initial={reduce ? undefined : "hidden"}
            whileInView={reduce ? undefined : "show"}
            viewport={{ once: true, margin: "-60px" }}
          >
            {s.doctorFeatures.map((f, idx) => {
              const Icon = DOCTOR_ICONS[idx];
              return (
                <motion.div
                  key={f.title}
                  variants={reduce ? undefined : item}
                  whileHover={reduce ? undefined : { y: -6 }}
                  className="rounded-2xl p-5"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background: "rgba(59,130,246,0.15)" }}>
                    <Icon className="w-4 h-4" style={{ color: "#3b82f6" }} />
                  </div>
                  <h3 className="font-bold text-sm mb-1.5">{f.title}</h3>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>{f.desc}</p>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* CEO orchestrator */}
      <section className="py-16 px-6" style={{ background: "rgba(255,255,255,0.02)" }}>
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <div className="flex items-center justify-center gap-2 mb-3">
              <Crown className="w-6 h-6" style={{ color: "#ea580c" }} />
              <h2 className="text-3xl font-bold text-center">{s.ceoTitle}</h2>
            </div>
            <p className="text-center mb-14 max-w-2xl mx-auto" style={{ color: "rgba(255,255,255,0.5)" }}>{s.ceoDesc}</p>
          </Reveal>

          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 gap-5"
            variants={reduce ? undefined : container}
            initial={reduce ? undefined : "hidden"}
            whileInView={reduce ? undefined : "show"}
            viewport={{ once: true, margin: "-60px" }}
          >
            {s.ceoFeatures.map((f, idx) => {
              const Icon = CEO_ICONS[idx];
              return (
                <motion.div
                  key={f.title}
                  variants={reduce ? undefined : item}
                  whileHover={reduce ? undefined : { y: -6 }}
                  className="rounded-2xl p-6"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-4" style={{ background: "rgba(234,88,12,0.15)" }}>
                    <Icon className="w-5 h-5" style={{ color: "#ea580c" }} />
                  </div>
                  <h3 className="font-bold mb-2">{f.title}</h3>
                  <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>{f.desc}</p>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-6 text-center">
        <Reveal>
          <h2 className="text-3xl font-bold mb-3">{s.finalCtaTitle}</h2>
          <p className="mb-8" style={{ color: "rgba(255,255,255,0.5)" }}>{s.finalCtaDesc}</p>
          <motion.div whileHover={reduce ? undefined : { scale: 1.03 }} whileTap={reduce ? undefined : { scale: 0.98 }} className="inline-block">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl text-white font-semibold text-lg"
              style={{ background: "linear-gradient(135deg, #ea580c, #f97316)", boxShadow: "0 8px 30px rgba(234,88,12,0.25)" }}
            >
              {s.finalCtaButton}
            </Link>
          </motion.div>
        </Reveal>
      </section>
    </>
  );
}
