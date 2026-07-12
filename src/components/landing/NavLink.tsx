"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

export default function NavLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <motion.div whileHover="hover" initial="rest" animate="rest" className="relative">
      <Link
        href={href}
        className="relative block text-sm px-3.5 py-2 rounded-xl font-medium transition-colors duration-200 hover:text-white"
        style={{ color: "rgba(255,255,255,0.65)" }}
      >
        <motion.span
          variants={{ rest: { opacity: 0, scale: 0.9 }, hover: { opacity: 1, scale: 1 } }}
          transition={{ duration: 0.18 }}
          className="absolute inset-0 rounded-xl -z-10"
          style={{ background: "rgba(255,255,255,0.07)" }}
        />
        <span className="relative">{children}</span>
      </Link>
    </motion.div>
  );
}

export function NavCta({ href, children }: { href: string; children: ReactNode }) {
  return (
    <motion.div whileHover={{ scale: 1.045 }} whileTap={{ scale: 0.97 }} className="mx-1">
      <Link
        href={href}
        className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-xl font-semibold text-white transition-shadow duration-300"
        style={{
          background: "linear-gradient(135deg, #ea580c, #f97316 55%, #fb923c)",
          boxShadow: "0 4px 20px rgba(234,88,12,0.35), 0 0 0 1px rgba(255,255,255,0.08) inset",
        }}
      >
        {children}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="rtl:rotate-180">
          <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>
    </motion.div>
  );
}
