"use client";

export function trackFeature(feature: string, metadata?: Record<string, unknown>) {
  // Fire-and-forget, never blocks UI
  fetch("/api/analytics/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ feature, metadata }),
  }).catch(() => {});
}
