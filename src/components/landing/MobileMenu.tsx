"use client";

import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import CurrencySelector from "@/components/ui/CurrencySelector";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher";

interface NavItem {
  href: string;
  label: string;
}

export default function MobileMenu({
  items, ctaHref, ctaLabel,
}: {
  items: NavItem[];
  ctaHref: string;
  ctaLabel: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <motion.button
        onClick={() => setOpen((v) => !v)}
        whileTap={{ scale: 0.9 }}
        aria-label="Menu"
        className="relative z-50 w-9 h-9 flex items-center justify-center rounded-lg"
        style={{ color: "white" }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
              <X className="w-6 h-6" />
            </motion.span>
          ) : (
            <motion.span key="menu" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }}>
              <Menu className="w-6 h-6" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40"
              style={{ background: "rgba(0,0,0,0.5)" }}
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ y: "-100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "-100%", opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.21, 0.47, 0.32, 0.98] }}
              className="fixed top-0 left-0 right-0 z-40 pt-20 pb-8 px-6"
              style={{ background: "#0a0a0fEE", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}
            >
              <div className="flex flex-col gap-1">
                {items.map((item, idx) => (
                  <motion.div
                    key={item.href}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.25, delay: idx * 0.05 }}
                  >
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="block py-3 px-4 rounded-xl text-base"
                      style={{ color: "rgba(255,255,255,0.85)" }}
                    >
                      {item.label}
                    </Link>
                  </motion.div>
                ))}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: items.length * 0.05 }}
                  className="mt-4"
                >
                  <Link
                    href={ctaHref}
                    onClick={() => setOpen(false)}
                    className="block text-center py-3 rounded-xl font-semibold text-white"
                    style={{ background: "linear-gradient(135deg, #ea580c, #f97316)" }}
                  >
                    {ctaLabel}
                  </Link>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: (items.length + 1) * 0.05 }}
                  className="flex items-center gap-2 mt-4 px-4"
                >
                  <CurrencySelector />
                  <LanguageSwitcher />
                </motion.div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
