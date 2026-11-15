/**
 * Re-render pricing (owner-delegated 2026-11-15). A re-render of a delivered project
 * reuses every unchanged paid image, clip, voice and music bed, so it costs half the
 * retail price for rendering and platform work, plus the share of media that really
 * has to be generated again:  price = retail × (0.5 + 0.5 × freshShare).
 * Only timing/order edits → 50 %; everything changed → 100 % (the approved retail).
 * At the cheapest credit pack the 50 % floor still keeps a ~65 % margin over the
 * rate card's render and platform estimate.
 */
export const RERENDER_BASE_SHARE = 0.5;
export function rerenderPrice(retailCredits: number, freshShare: number) {
  const share = Math.min(1, Math.max(0, freshShare));
  return Math.ceil(retailCredits * (RERENDER_BASE_SHARE + (1 - RERENDER_BASE_SHARE) * share));
}
