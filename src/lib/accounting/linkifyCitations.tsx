import Link from "next/link";
import React from "react";

/**
 * Turns the Finance AI Agent's mandatory "(حساب ۵۲۰۰)" / "(account 5200)"
 * citations into clickable links to that account's ledger drill-down page
 * (/accounting/accounts/[code]) — so a cited number is actually traceable
 * back to its source journal lines, not just plain text. Matches both
 * Persian and Latin digits since the model sometimes renders one or the
 * other depending on which provider answered.
 */
const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

function toLatinDigits(s: string): string {
  return s.replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)));
}

const CITATION_RE = /(حساب|account)\s*([۰-۹\d]{3,5})/gi;

export function linkifyCitations(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  CITATION_RE.lastIndex = 0;
  while ((match = CITATION_RE.exec(text)) !== null) {
    const [full, word, digits] = match;
    const code = toLatinDigits(digits);
    parts.push(text.slice(lastIndex, match.index));
    parts.push(
      <Link key={key++} href={`/accounting/accounts/${code}`} className="underline decoration-dotted" style={{ color: "inherit" }}>
        {word} {digits}
      </Link>
    );
    lastIndex = match.index + full.length;
  }
  parts.push(text.slice(lastIndex));
  return parts;
}
