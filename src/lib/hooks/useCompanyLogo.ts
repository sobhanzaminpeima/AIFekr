"use client";

import { useEffect, useState } from "react";

/**
 * Fetches the workspace's company logo (uploaded once in Business Doctor,
 * src/app/api/business-profile/logo) so print views — CRM invoices/contracts,
 * accounting payslips/owner-statements — can brand their output without each
 * one re-implementing the fetch. Returns null until loaded or if no logo is set.
 */
export function useCompanyLogo(): string | null {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/crm/company-logo").then((r) => r.json()).then((d) => setLogoUrl(d.logoUrl || null)).catch(() => {});
  }, []);
  return logoUrl;
}
