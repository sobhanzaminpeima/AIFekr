import { NextRequest, NextResponse } from "next/server";
import { searchDestinations } from "@/lib/navigation/workspaces";

const LANGS = ["fa", "en", "de", "tr"] as const;

/** The command palette's goal search (names and synonyms of real routes, no AI call), for the new design. */
export function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").slice(0, 120);
  const raw = req.nextUrl.searchParams.get("lang");
  const lang = LANGS.includes(raw as (typeof LANGS)[number]) ? (raw as (typeof LANGS)[number]) : "fa";
  return NextResponse.json({ results: searchDestinations(q, lang, 10).map(({ href, label }) => ({ href, label })) });
}
