/**
 * Business boundary for accounting queries. Returns the `businessId` fragment
 * to spread into a Prisma `where` (reads/lookups) or `data` (creates), and an
 * empty object for legacy callers that have no verified business yet -- the
 * same additive-migration rule as businessFilter() in crm/workspace.ts. Every
 * accounting function takes `businessId` as an OPTIONAL trailing argument so
 * existing callers (cron jobs, agents, tests) keep working unchanged while the
 * API routes pass the verified `ws.businessId`.
 */
export function bizScope(businessId?: string | null): { businessId?: string } {
  return businessId ? { businessId } : {};
}
