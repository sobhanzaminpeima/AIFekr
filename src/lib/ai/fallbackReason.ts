/**
 * The provider's own error, safe to store: credentials that some providers echo
 * back (query-string keys, bearer tokens, sk- keys) are removed, and the text
 * is capped like the ProviderFallbackLog column expects.
 */
export function fallbackReason(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const clean = raw
    .replace(/([?&](?:key|api_key|access_token)=)[^&\s"']+/gi, "$1[redacted]")
    .replace(/Bearer\s+[\w.\-~+/=]+/gi, "Bearer [redacted]")
    .replace(/\b(sk|gsk|xai|AIza)[-_]?[\w-]{12,}\b/g, "[redacted]")
    .replace(/\s+/g, " ")
    .trim();
  return (clean || "unknown error").slice(0, 500);
}
