export const DEFAULT_ECONOMY_DISCOUNT_PERCENT = 20;

/** Both prices use the same unit (credits or the smallest currency unit). */
export function economyPrice(standardUnitPrice: number, discountPercent = DEFAULT_ECONOMY_DISCOUNT_PERCENT): number {
  if (!Number.isSafeInteger(standardUnitPrice) || standardUnitPrice < 2) {
    throw new RangeError("No positive economy price below the standard price");
  }
  if (!Number.isInteger(discountPercent) || discountPercent < 1 || discountPercent > 99) {
    throw new RangeError("Economy discount must be an integer between 1 and 99");
  }
  const discounted = Number((BigInt(standardUnitPrice) * BigInt(100 - discountPercent)) / BigInt(100));
  return Math.max(1, discounted);
}
