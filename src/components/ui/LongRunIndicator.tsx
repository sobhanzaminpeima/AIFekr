"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { tri, type Lang } from "@/lib/i18n";

/**
 * Feedback for AI runs that take tens of seconds (Business Doctor, CEO Advisor,
 * Meeting Room).
 *
 * QA 2026-09-15 listed it as a missing feature: during long waits there was no
 * approximate time, no stage, and no way to cancel — just a spinner — so users
 * couldn't tell whether to keep waiting or resend, and resending started a
 * second paid run. This shows elapsed time, a stage hint that changes as the
 * wait grows, an expected-duration note, and a cancel button.
 *
 * Cancelling is the caller's job (abort its own fetch); this only renders the
 * control. Credits are deducted only on success, which the cancel note says.
 */
export default function LongRunIndicator({
  lang,
  expectedSeconds,
  onCancel,
  receivedAny = false,
}: {
  lang: Lang;
  /** Rough typical duration, shown as "usually ~N s". */
  expectedSeconds: number;
  onCancel?: () => void;
  /** True once the first streamed text has arrived. */
  receivedAny?: boolean;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  const stage = receivedAny
    ? tri(lang, "در حال نوشتن پاسخ...", "Writing the answer...", "Antwort wird geschrieben...")
    : elapsed < 8
      ? tri(lang, "در حال خواندن اطلاعات کسب‌وکار...", "Reading your business data...", "Geschäftsdaten werden gelesen...")
      : elapsed < expectedSeconds
        ? tri(lang, "در حال تحلیل...", "Analysing...", "Analyse läuft...")
        : tri(lang, "بیشتر از معمول طول کشیده — هنوز در حال انجام است", "Taking longer than usual — still working", "Dauert länger als üblich — läuft noch");

  return (
    <div className="flex items-center gap-3 rounded-xl px-3 py-2 text-xs" style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }} role="status" aria-live="polite">
      <span className="w-4 h-4 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin flex-shrink-0" />
      <span className="flex-1 min-w-0">
        <span className="block" style={{ color: "var(--text-primary)" }}>{stage}</span>
        <span className="block" style={{ color: "var(--text-muted)" }}>
          {tri(lang,
            `${elapsed} ثانیه گذشته · معمولاً حدود ${expectedSeconds} ثانیه`,
            `${elapsed}s elapsed · usually about ${expectedSeconds}s`,
            `${elapsed} s vergangen · meist etwa ${expectedSeconds} s`)}
        </span>
      </span>
      {onCancel && (
        <button
          onClick={onCancel}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg flex-shrink-0"
          style={{ background: "var(--surface-1)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
          title={tri(lang, "لغو — کردیتی کسر نمی‌شود", "Cancel — no credits are charged", "Abbrechen — kein Guthaben wird abgebucht")}
        >
          <X className="w-3 h-3" />
          {tri(lang, "لغو", "Cancel", "Abbrechen")}
        </button>
      )}
    </div>
  );
}
