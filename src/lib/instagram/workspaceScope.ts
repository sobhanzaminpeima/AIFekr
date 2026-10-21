/** Exact Instagram workspace scope. Unlike the additive migration helper in
 * accounting, null must mean the legacy/null workspace only, never every
 * business belonging to the same user. */
export function instagramWorkspaceScope(businessId: string | null): { businessId: string | null } {
  return { businessId };
}
