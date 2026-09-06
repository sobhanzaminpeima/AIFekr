// Deliberately free of server-only imports (no prisma), because the accounting
// dashboard is a client component. Importing this from chartOfAccounts.ts --
// which does import prisma -- would push server code across the client
// boundary; that is the exact shape of the bug that made every 404 on the site
// throw when `tri` was imported from the "use client" i18n index.

import type { Lang } from "@/lib/i18n";

/**
 * Picks a ledger account's name for a reader.
 *
 * German used to fall through to the English name: AccountingAccount has had a
 * `nameDe` column all along, but nothing ever wrote it and no render site ever
 * read it. Falls back to the Persian `name`, the only one guaranteed non-null —
 * an account the user created themselves has no translations at all, and their
 * own label beats an empty cell.
 */
export function accountName(
  account: { name: string; nameEn?: string | null; nameDe?: string | null },
  lang: Lang,
): string {
  if (lang === "en") return account.nameEn || account.name;
  if (lang === "de") return account.nameDe || account.nameEn || account.name;
  return account.name;
}
