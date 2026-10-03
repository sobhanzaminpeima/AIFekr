"use client";
import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
/** Visible on the server and without JS; motion never hides public content. */
export default function MotionReveal({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  return <motion.div initial={false} whileInView={reduced ? undefined : { y: [8, 0] }} viewport={{ once: true }} transition={{ duration: 0.35 }}>{children}</motion.div>;
}
