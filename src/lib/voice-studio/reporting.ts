/**
 * Credits returned to users, split by why. A paid generation first holds the
 * estimate and, once the audio is READY, charges the real duration and
 * releases the rest of the hold; that is not a refund. Only a job that did
 * not finish gets a real refund. The admin report used to add both together,
 * which in November 2026 read as "135 charged, 135 refunded" for a period in
 * which every job had succeeded and been charged correctly.
 */
export function voiceCreditsReturned(groups: { status: string; _sum: { refundedCredits: number | null } }[]) {
  let releasedHold = 0, refundedFailure = 0;
  for (const g of groups) {
    const amount = g._sum.refundedCredits ?? 0;
    if (g.status === "READY") releasedHold += amount;
    else refundedFailure += amount;
  }
  return { releasedHold, refundedFailure };
}
