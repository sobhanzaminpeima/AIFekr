"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { moduleForPath } from "@/lib/growth/attribution";

/** Fire-and-forget beacon; tracking must never affect the page. */
export function growthEvent(name: string, data: { moduleId?: string | null; metadata?: Record<string, string | number | boolean | null>; key?: string } = {}) {
  try {
    void fetch("/api/growth/event", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, ...data }), keepalive: true }).catch(() => {});
  } catch { /* ignore */ }
}

function onceThisSession(key: string): boolean {
  try { if (sessionStorage.getItem(key)) return false; sessionStorage.setItem(key, "1"); return true; } catch { return true; }
}

/**
 * Records the landing touch (UTM / external referrer only) and coarse page
 * views that the server cannot see: pricing and module visits, once per
 * browser session. No content, no form values.
 */
export default function GrowthTracker() {
  const pathname = usePathname();
  const landed = useRef(false);
  useEffect(() => {
    if (landed.current) return;
    landed.current = true;
    const hasCampaign = /[?&]utm_(source|campaign)=/.test(location.search);
    const external = document.referrer && !document.referrer.startsWith(location.origin);
    if (hasCampaign || external) {
      void fetch("/api/growth/touch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: location.pathname + location.search, referrer: document.referrer || null }), keepalive: true }).catch(() => {});
    }
  }, []);
  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin") || pathname.startsWith("/api")) return;
    const path = pathname.replace(/^\/(en|de|tr)(?=\/|$)/, "") || "/";
    if ((path === "/pricing" || path === "/plans") && onceThisSession("afk:pricing")) growthEvent("pricing_page_viewed");
    else if (path === "/register" && onceThisSession("afk:signup")) growthEvent("signup_started");
    else {
      const moduleId = moduleForPath(path);
      if (moduleId && onceThisSession(`afk:module:${moduleId}`)) growthEvent("module_viewed", { moduleId, metadata: { landing: path.startsWith("/features/") } });
    }
  }, [pathname]);
  return null;
}
