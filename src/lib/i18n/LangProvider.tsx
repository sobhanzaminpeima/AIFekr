"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Lang } from "./index";

/**
 * Carries the language the SERVER already resolved from the `lang` cookie down
 * to every client component.
 *
 * Without it, `useTranslation` started at `useState<Lang>("fa")` and only read
 * the cookie in a `useEffect` — which runs after hydration. So the server, and
 * the browser's first paint, rendered Persian for everyone. Measured on the
 * built app: requesting /welcome with `lang=de` returned the Persian question
 * "کسب‌وکار شما در چه…" in the HTML, and it flipped to German a moment later.
 * A German or English user saw a flash of Persian on every client-rendered
 * page, which is most of the dashboard.
 *
 * The root layout already resolves the language for `<html lang>`; this feeds
 * the same value to the hook so server and client agree from the first byte.
 */
const LangContext = createContext<Lang | null>(null);

export function LangProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

/** Null when no provider is above — the hook then falls back to reading the cookie itself. */
export function useServerLang(): Lang | null {
  return useContext(LangContext);
}
