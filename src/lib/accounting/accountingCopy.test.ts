import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { ACCOUNTING_STRINGS, accountingCopy } from "./accountingCopy";
import { ACCOUNTING_SOURCES } from "./accountingCopy.sources";
import { extractKeyedStrings } from "@/lib/crm/crmCopy.extract";
import { ledgerErrorMessage } from "./ledgerErrors";
import { PeriodLockedError, UnbalancedEntryError } from "./ledger";

const root = join(__dirname, "../../..");

it("is word for word the classic accounting pages' wording", () => {
  expect(ACCOUNTING_STRINGS).toEqual(extractKeyedStrings(ACCOUNTING_SOURCES.map((f) => readFileSync(join(root, f), "utf8"))));
});
it("localizes accounting, keeping each page's own wording", () => {
  expect(accountingCopy("fa")["Cash balance"]).toBe("موجودی نقدی");
  expect(accountingCopy("de")["Reopen"]).toBe("Wieder öffnen");
  expect(accountingCopy("fa")["Description"]).not.toBe(accountingCopy("fa")["Description · 2"]);
  expect(accountingCopy("tr")["Cash balance"]).toBe("Cash balance");
});
it("explains the ledger's refusals in the reader's language", () => {
  expect(ledgerErrorMessage(new UnbalancedEntryError(10, 5), "fa")).toContain("برابر نیست");
  expect(ledgerErrorMessage(new PeriodLockedError(new Date()), "en")).toBe("The fiscal period for this date is closed");
  expect(ledgerErrorMessage(new Error("A journal entry needs at least two lines"), "de")).toContain("mindestens zwei Zeilen");
});
