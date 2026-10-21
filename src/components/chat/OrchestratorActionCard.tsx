"use client";

import { useState } from "react";
import { Check, X, Loader2, ShieldCheck, AlertTriangle } from "lucide-react";
import { tri } from "@/lib/i18n/tri";
import type { Lang } from "@/lib/i18n";

/**
 * The confirmation card for one staged COMMIT action (Phase 1, §3.4).
 *
 * `summary` is server-authored: it was built by the tool's own
 * `summarize()` from the *validated* arguments at propose time and stored on
 * the OrchestratorAction row, then handed to the client. It is deliberately
 * not taken from the model's prose, so an answer that describes one change
 * while having requested another cannot make this card lie about what
 * pressing confirm will do.
 *
 * Confirming posts the action's id and nothing else — the arguments that
 * execute are the stored ones, never anything this component could resend.
 */

export interface OrchestratorAction {
  id: string;
  summary: string;
  expiresAt: string;
}

type CardState = "pending" | "running" | "executed" | "rejected" | "failed" | "expired";

export default function OrchestratorActionCard({ action, lang }: { action: OrchestratorAction; lang: Lang }) {
  const expiredOnArrival = new Date(action.expiresAt).getTime() < Date.now();
  const [state, setState] = useState<CardState>(expiredOnArrival ? "expired" : "pending");
  const [error, setError] = useState<string | null>(null);

  const copy = {
    needsConfirm: tri(lang, "این کار نیاز به تأیید شما دارد", "This needs your confirmation", "Dies erfordert Ihre Bestätigung"),
    confirm: tri(lang, "تأیید و انجام بده", "Confirm and do it", "Bestätigen und ausführen"),
    reject: tri(lang, "انصراف", "Cancel", "Abbrechen"),
    executed: tri(lang, "انجام شد", "Done", "Erledigt"),
    rejected: tri(lang, "انجام نشد", "Not done", "Nicht ausgeführt"),
    failed: tri(lang, "انجام نشد — خطایی رخ داد", "Couldn't be done — something went wrong", "Konnte nicht ausgeführt werden — ein Fehler ist aufgetreten"),
    expired: tri(lang, "این درخواست منقضی شده — دوباره بپرسید", "This request expired — ask again", "Diese Anfrage ist abgelaufen — fragen Sie erneut"),
  };

  async function resolve(confirm: boolean) {
    setState("running");
    setError(null);
    try {
      const res = await fetch(`/api/orchestrator/action/${action.id}`, { method: confirm ? "POST" : "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 410) {
          setState("expired");
          return;
        }
        setState(confirm ? "failed" : "pending");
        setError(typeof body.error === "string" ? body.error : null);
        return;
      }
      setState(confirm ? "executed" : "rejected");
    } catch {
      setState(confirm ? "failed" : "pending");
    }
  }

  const resolved = state === "executed" || state === "rejected" || state === "failed" || state === "expired";
  const tone =
    state === "executed"
      ? { border: "#1baf7a", tint: "rgba(27,175,122,0.12)", color: "#1baf7a" }
      : state === "failed" || state === "expired"
        ? { border: "var(--border)", tint: "var(--surface-2)", color: "var(--text-muted)" }
        : { border: "#f59e0b", tint: "rgba(245,158,11,0.10)", color: "#f59e0b" };

  return (
    <div
      className="mt-2 rounded-2xl px-3.5 py-3 text-sm"
      style={{ background: tone.tint, border: `1px solid ${tone.border}` }}
    >
      <div className="flex items-start gap-2">
        {state === "executed" ? (
          <Check className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: tone.color }} />
        ) : state === "failed" || state === "expired" ? (
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: tone.color }} />
        ) : (
          <ShieldCheck className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: tone.color }} />
        )}
        <div className="min-w-0 flex-1">
          {!resolved && (
            <div className="text-[11px] mb-1" style={{ color: tone.color }}>
              {copy.needsConfirm}
            </div>
          )}
          <div style={{ color: "var(--text-primary)" }}>{action.summary}</div>

          {state === "expired" && (
            <div className="text-[11px] mt-1.5" style={{ color: "var(--text-muted)" }}>{copy.expired}</div>
          )}
          {state === "failed" && (
            <div className="text-[11px] mt-1.5" style={{ color: "var(--text-muted)" }}>
              {copy.failed}
              {error ? ` (${error})` : ""}
            </div>
          )}
          {state === "executed" && (
            <div className="text-[11px] mt-1.5" style={{ color: tone.color }}>{copy.executed}</div>
          )}
          {state === "rejected" && (
            <div className="text-[11px] mt-1.5" style={{ color: "var(--text-muted)" }}>{copy.rejected}</div>
          )}
        </div>
      </div>

      {(state === "pending" || state === "running") && (
        <div className="flex items-center gap-2 mt-2.5">
          <button
            onClick={() => resolve(true)}
            disabled={state === "running"}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl font-medium disabled:opacity-50"
            style={{ background: "#f59e0b", color: "#fff" }}
          >
            {state === "running" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            {copy.confirm}
          </button>
          <button
            onClick={() => resolve(false)}
            disabled={state === "running"}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl disabled:opacity-50"
            style={{ background: "var(--surface-2)", color: "var(--text-secondary)" }}
          >
            <X className="w-3.5 h-3.5" />
            {copy.reject}
          </button>
        </div>
      )}
    </div>
  );
}
