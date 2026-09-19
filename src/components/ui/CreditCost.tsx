"use client";

import { useEffect, useState } from "react";
import { Coins } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { toolCostKey } from "@/lib/utils/credits";

/**
 * "N credits" label for any button that spends credits. The number comes from
 * the same admin-editable Credit Rules the charge routes read (GET
 * /api/credits/costs), so a price change in the admin panel shows on every
 * button at once and can never drift from what is actually charged.
 */
let cache: Record<string, number> | null = null;
let inflight: Promise<Record<string, number>> | null = null;

function loadCosts(): Promise<Record<string, number>> {
  if (cache) return Promise.resolve(cache);
  inflight ??= fetch("/api/credits/costs", { credentials: "include" })
    .then((r) => (r.ok ? r.json() : { costs: {} }))
    .then((d) => (cache = d.costs || {}))
    .catch(() => ({}))
    .finally(() => { inflight = null; });
  return inflight;
}

export function useCreditCosts(): Record<string, number> | null {
  const [costs, setCosts] = useState<Record<string, number> | null>(cache);
  useEffect(() => {
    let alive = true;
    loadCosts().then((c) => alive && setCosts(c));
    return () => { alive = false; };
  }, []);
  return costs;
}

interface Props {
  /** A text-tool feature id from TOOL_FEATURES, e.g. "seo.analyze". */
  feature?: string;
  /** A fixed cost key from CREDIT_COSTS, e.g. "image_standard", "video_5s", "music_30s", "chat". */
  costKey?: string;
  /** Cost that depends on the user's choice (e.g. a chosen model/duration); used as-is when given. */
  amount?: number;
  /** Multiplier for per-item pricing (e.g. images generated per click). */
  times?: number;
  /** Extra cost keys charged by the same click (e.g. a text step plus an image), added to the total. */
  plus?: string[];
  className?: string;
}

export default function CreditCost({ feature, costKey, amount, times = 1, plus, className }: Props) {
  const { lang } = useTranslation();
  const costs = useCreditCosts();

  const unit = amount ?? (costs ? costs[feature ? toolCostKey(feature) : costKey || ""] ?? (feature ? costs.tool : undefined) : undefined);
  const extra = costs ? (plus ?? []).reduce((sum, k) => sum + (costs[k] ?? 0), 0) : 0;
  const value = unit == null ? null : unit * times + extra;
  if (value == null) return null;
  if (value === 0) return null;

  const n = lang === "fa" ? value.toLocaleString("fa-IR") : String(value);
  const word =
    lang === "fa" ? "اعتبار" : lang === "de" ? (value === 1 ? "Credit" : "Credits") : lang === "tr" ? "kredi" : value === 1 ? "credit" : "credits";

  return (
    <span
      className={"inline-flex items-center gap-1 text-[11px] font-medium opacity-80 whitespace-nowrap " + (className ?? "")}
      title={lang === "fa" ? "هزینه این عملیات" : lang === "de" ? "Kosten dieser Aktion" : lang === "tr" ? "Bu işlemin maliyeti" : "Cost of this action"}
    >
      <Coins className="w-3 h-3" aria-hidden="true" />
      {n} {word}
    </span>
  );
}
