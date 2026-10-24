import type { Lang } from "@/lib/i18n";
import { tri } from "@/lib/i18n/tri";
import { formatNumber } from "@/lib/utils/jalali";

/**
 * Large money figures as people say them ("۱۲۱٫۵ میلیارد", "121.5B") for
 * dashboards and board cards, where an 11-digit toman amount is unreadable
 * at a glance. Exact amounts (invoices, payments) keep the full number.
 */
export function compactAmount(n: number, lang: Lang): string {
  const v = Math.round(n);
  if (Math.abs(v) < 1_000_000) return formatNumber(v, lang);
  const billions = v / 1_000_000_000;
  if (Math.abs(billions) >= 1) return `${formatNumber(Math.round(billions * 10) / 10, lang)} ${tri(lang, "میلیارد", "B", "Mrd.", "B")}`;
  return `${formatNumber(Math.round(v / 100_000) / 10, lang)} ${tri(lang, "میلیون", "M", "Mio.", "M")}`;
}
