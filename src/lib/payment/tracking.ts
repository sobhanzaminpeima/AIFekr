export const PAYMENT_HISTORY_PAGE_SIZE = 30;
export type PaymentHistoryFilter = "all" | "pending" | "paid" | "problem";

export function paymentHistoryQuery(search: URLSearchParams) {
  const rawPage = search.get("page") || "1";
  const page = /^\d+$/.test(rawPage) ? Math.min(10000, Math.max(1, Number(rawPage))) : 1;
  const rawFilter = search.get("filter");
  const filter: PaymentHistoryFilter = rawFilter === "pending" || rawFilter === "paid" || rawFilter === "problem" ? rawFilter : "all";
  const statuses = filter === "pending" ? ["PENDING"] : filter === "paid" ? ["SUCCESS", "PAID"] : filter === "problem" ? ["REJECTED", "FAILED", "CANCELLED", "EXPIRED"] : null;
  return { page, filter, statuses };
}

/** Only a saved, official Zarinpal checkout may be resumed; no new charge is created. */
export function savedGatewayUrl(gateway: string, snapshot: string | null) {
  if (gateway !== "zarinpal" || !snapshot) return null;
  try {
    const url = new URL(JSON.parse(snapshot).paymentUrl);
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.search || url.hash) return null;
    if (!["www.zarinpal.com", "sandbox.zarinpal.com"].includes(url.hostname)) return null;
    if (!/^\/pg\/StartPay\/[a-zA-Z0-9-]+$/.test(url.pathname)) return null;
    return url.toString();
  } catch { return null; }
}
