// Phase 3 of the monetization overhaul: four billing periods per the master
// prompt (monthly / 3mo / 6mo / yearly), each a straight discount off the
// monthly price scaled by month count -- deeper discount the longer the
// commitment, same shape as the pre-existing annual-only discount.
export const PERIOD_MONTHS: Record<string, number> = { monthly: 1, quarterly: 3, semiannual: 6, annual: 12 };
export const PERIOD_DISCOUNT: Record<string, number> = { monthly: 0, quarterly: 0.05, semiannual: 0.1, annual: 2 / 12 };

export function resolvePeriod(period: string): { months: number; discount: number } {
  const months = PERIOD_MONTHS[period] ?? 1;
  const discount = PERIOD_DISCOUNT[period] ?? 0;
  return { months, discount };
}
