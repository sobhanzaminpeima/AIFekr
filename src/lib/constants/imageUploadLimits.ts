/**
 * How many reference photos a user can attach to one image-generation turn
 * (e.g. two people for the "couple" 1980s prompt). Free accounts are capped
 * low mainly to bound per-request cost (each reference photo OpenAI's edit
 * endpoint receives adds real spend) -- paid plans get the full 7.
 */
export function maxReferenceImages(plan: string | null | undefined): number {
  return plan && plan !== "FREE" ? 7 : 2;
}
