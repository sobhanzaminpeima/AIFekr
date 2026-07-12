"use client";

import { motion, useScroll, useTransform, useReducedMotion, useSpring } from "framer-motion";
import type { ReactNode } from "react";

export default function AnimatedNavbar({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  const { scrollY, scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 25, mass: 0.2 });

  const outerPadding = useTransform(scrollY, [0, 120], [18, 8]);
  const barPadding = useTransform(scrollY, [0, 120], [14, 8]);
  const bg = useTransform(scrollY, [0, 120], ["rgba(15,15,20,0.35)", "rgba(15,15,20,0.72)"]);
  const blur = useTransform(scrollY, [0, 120], [10, 20]);
  const borderOpacity = useTransform(scrollY, [0, 120], [0.06, 0.12]);
  const shadowOpacity = useTransform(scrollY, [0, 120], [0.15, 0.4]);
  const maxWidth = useTransform(scrollY, [0, 120], [1180, 980]);

  const backdropFilter = useTransform(blur, (v) => `blur(${v}px)`);
  const borderColor = useTransform(borderOpacity, (v) => `rgba(255,255,255,${v})`);
  const boxShadow = useTransform(shadowOpacity, (v) => `0 8px 32px rgba(0,0,0,${v}), 0 1px 0 rgba(255,255,255,0.05) inset`);

  return (
    <motion.div
      initial={reduce ? undefined : { y: -60, opacity: 0 }}
      animate={reduce ? undefined : { y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.21, 0.47, 0.32, 0.98] }}
      style={{ paddingTop: reduce ? 14 : outerPadding, paddingInline: reduce ? 14 : outerPadding }}
      className="fixed top-0 left-0 right-0 z-50 flex justify-center px-3"
    >
      <motion.nav
        style={{
          paddingTop: reduce ? 10 : barPadding,
          paddingBottom: reduce ? 10 : barPadding,
          background: reduce ? "rgba(15,15,20,0.75)" : bg,
          backdropFilter: reduce ? "blur(16px)" : backdropFilter,
          WebkitBackdropFilter: reduce ? "blur(16px)" : backdropFilter,
          border: "1px solid",
          borderColor: reduce ? "rgba(255,255,255,0.08)" : borderColor,
          boxShadow: reduce ? "0 8px 32px rgba(0,0,0,0.25)" : boxShadow,
          maxWidth: reduce ? 1180 : maxWidth,
        }}
        className="relative flex w-full items-center justify-between gap-2 rounded-2xl px-4 transition-[max-width] duration-300"
      >
        {children}
        {!reduce && (
          <motion.div
            className="pointer-events-none absolute inset-x-4 bottom-0 h-px origin-left rounded-full"
            style={{
              scaleX: progress,
              background: "linear-gradient(90deg, #ea580c, #f97316, #fb923c)",
              opacity: 0.8,
            }}
          />
        )}
      </motion.nav>
    </motion.div>
  );
}
