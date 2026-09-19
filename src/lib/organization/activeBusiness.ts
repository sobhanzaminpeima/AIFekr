import { resolveOrganizationContext } from "@/lib/organization/context";

/**
 * The business an owner is currently working in, for per-owner modules that do
 * not go through resolveCrmWorkspace (voice agents, lead forms, connectors).
 * Null for a user with no provisioned business, which callers treat as "no
 * business filter" -- the same additive rule as the rest of the platform.
 */
export async function activeBusinessIdFor(userId: string): Promise<string | null> {
  const ctx = await resolveOrganizationContext(userId);
  return ctx?.businessId ?? null;
}
