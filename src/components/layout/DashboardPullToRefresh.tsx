"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { tri, type Lang } from "@/lib/i18n";

const START_DISTANCE = 76;

/** Native-feeling pull-to-refresh for the dashboard's primary mobile scroller. */
export default function DashboardPullToRefresh({ lang }: { lang: Lang }) {
  const router = useRouter();
  const startY = useRef<number | null>(null);
  const pulling = useRef(false);
  const distanceRef = useRef(0);
  const [distance, setDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;
    if (window.getComputedStyle(main).overflowY === "hidden") return;

    function onTouchStart(event: TouchEvent) {
      if (window.matchMedia("(min-width: 768px)").matches || refreshing || event.touches.length !== 1) return;
      if (main!.scrollTop <= 0) startY.current = event.touches[0].clientY;
    }
    function onTouchMove(event: TouchEvent) {
      if (startY.current === null || refreshing || !event.touches.length) return;
      const delta = event.touches[0].clientY - startY.current;
      if (delta <= 0) { pulling.current = false; setDistance(0); return; }
      pulling.current = true;
      const nextDistance = Math.min(START_DISTANCE, delta * 0.48);
      distanceRef.current = nextDistance;
      setDistance(nextDistance);
      if (delta > 8) event.preventDefault();
    }
    function onTouchEnd() {
      const shouldRefresh = pulling.current && distanceRef.current >= START_DISTANCE * 0.72;
      startY.current = null;
      pulling.current = false;
      distanceRef.current = 0;
      setDistance(0);
      if (!shouldRefresh) return;
      setRefreshing(true);
      router.refresh();
      window.setTimeout(() => setRefreshing(false), 900);
    }

    main.addEventListener("touchstart", onTouchStart, { passive: true });
    main.addEventListener("touchmove", onTouchMove, { passive: false });
    main.addEventListener("touchend", onTouchEnd, { passive: true });
    main.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      main.removeEventListener("touchstart", onTouchStart);
      main.removeEventListener("touchmove", onTouchMove);
      main.removeEventListener("touchend", onTouchEnd);
      main.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [refreshing, router]);

  if (!distance && !refreshing) return null;
  return <div aria-live="polite" className="md:hidden fixed top-[calc(58px+env(safe-area-inset-top))] inset-x-0 z-[55] flex justify-center pointer-events-none" style={{ transform: `translateY(${refreshing ? 8 : Math.max(0, distance - 24)}px)` }}>
    <div className="flex items-center gap-2 rounded-full border px-3 py-2 text-xs shadow-lg" style={{ color: "var(--text-primary)", background: "var(--surface-1)", borderColor: "var(--border)" }}>
      {refreshing ? <Loader2 size={15} className="animate-spin"/> : <RefreshCw size={15}/>}
      {refreshing ? tri(lang, "در حال تازه‌سازی…", "Refreshing…", "Wird aktualisiert…", "Yenileniyor…") : tri(lang, "برای تازه‌سازی رها کن", "Release to refresh", "Zum Aktualisieren loslassen", "Yenilemek için bırak")}
    </div>
  </div>;
}
