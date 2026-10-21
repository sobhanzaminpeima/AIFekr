"use client";
import type { ReactNode } from "react";
/** Visible on the server and without JS; motion never hides public content. */
export default function MotionReveal({ children }: { children: ReactNode }) {
  return <div className="m-reveal">{children}</div>;
}
