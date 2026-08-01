"use client";

import { useState, useEffect } from "react";
import { type Currency, CURRENCY_SYMBOLS, getCurrency, setCurrency } from "@/lib/currency";

const CURRENCIES: Currency[] = ["USD", "EUR", "AED", "GBP", "IRR"];

export default function CurrencySelector({ className = "", iconOnly = false }: { className?: string; iconOnly?: boolean }) {
  const [currency, setCurrencyState] = useState<Currency>("USD");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setCurrencyState(getCurrency());
  }, []);

  function select(c: Currency) {
    setCurrencyState(c);
    setCurrency(c);
    setOpen(false);
    window.location.reload();
  }

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setOpen(!open)}
        title={currency}
        className={`flex items-center justify-center transition-all ${iconOnly ? "w-8 h-8 rounded-lg" : "gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium"}`}
        style={{ background: "var(--surface-2)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
      >
        <span className={iconOnly ? "text-sm" : ""}>{CURRENCY_SYMBOLS[currency]}</span>
        {!iconOnly && (
          <>
            <span>{currency}</span>
            <span className="text-xs opacity-60">▾</span>
          </>
        )}
      </button>

      {open && (
        <div
          className="absolute bottom-full mb-1 left-0 rounded-xl overflow-hidden z-50"
          style={{ background: "var(--surface-1)", border: "1px solid var(--border)", minWidth: "100px", boxShadow: "0 4px 24px rgba(0,0,0,0.4)" }}
        >
          {CURRENCIES.map(c => (
            <button
              key={c}
              onClick={() => select(c)}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs transition-all text-right"
              style={{
                background: c === currency ? "rgba(234,88,12,0.1)" : "transparent",
                color: c === currency ? "var(--primary)" : "var(--text-secondary)",
              }}
            >
              <span className="font-medium">{CURRENCY_SYMBOLS[c]}</span>
              <span>{c}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
