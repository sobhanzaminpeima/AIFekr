export type CheckoutStage = "transfer" | "receipt" | "review" | "approved" | "closed";

/** Client transfer acknowledgement only changes guidance; it never grants access. */
export function checkoutStage(payment: { status: string; receiptAt: string | null }, transferAcknowledged = false): CheckoutStage {
  if (payment.status === "SUCCESS") return "approved";
  if (payment.status !== "PENDING") return "closed";
  if (payment.receiptAt) return "review";
  return transferAcknowledged ? "receipt" : "transfer";
}
