/**
 * End of a purchased access term. A term that is a whole number of months in
 * the order (periodMonths) and was priced as 30 days per month ends after
 * that many CALENDAR months (UTC; 31 January + 1 month = 28/29 February, not
 * 2 March); any other term (credit packs, custom day counts) keeps its days.
 * Renewals start from the later of now and the current expiry, as before.
 */
export function addCalendarMonths(from: Date, months: number): Date {
  const y = from.getUTCFullYear(), m = from.getUTCMonth() + months, d = from.getUTCDate();
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(d, lastDay), from.getUTCHours(), from.getUTCMinutes(), from.getUTCSeconds(), from.getUTCMilliseconds()));
}

export function termEnd(from: Date, days: number, months?: number | null): Date {
  if (months && Number.isInteger(months) && months > 0 && days === months * 30) return addCalendarMonths(from, months);
  return new Date(from.getTime() + days * 86400000);
}

/** The new expiry for a purchase: stacked on the current expiry when that is still in the future. */
export function renewedExpiry(current: Date | null | undefined, days: number, months?: number | null, now = new Date()): Date {
  const start = current && current.getTime() > now.getTime() ? current : now;
  return termEnd(start, days, months);
}
