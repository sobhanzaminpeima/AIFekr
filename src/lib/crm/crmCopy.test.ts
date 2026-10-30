import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { CRM_LABELS, CRM_STRINGS, crmCopy } from "./crmCopy";
import { extractCrmLabels, extractCrmStrings } from "./crmCopy.extract";

const classic = readFileSync(join(__dirname, "../../app/(dashboard)/(business)/crm/page.tsx"), "utf8");

it("is word for word the classic CRM page's wording", () => {
  expect(CRM_STRINGS).toEqual(extractCrmStrings(classic));
  expect(CRM_LABELS).toEqual(extractCrmLabels(classic));
});
it("localizes the CRM", () => {
  expect(crmCopy("fa").strings["Owner of {properties}"]).toBe("مالک {properties} ملک");
  expect(crmCopy("tr").strings["{createdCount} of {totalRows} rows imported successfully"]).toBe("{totalRows} satırdan {createdCount} tanesi başarıyla içe aktarıldı");
  expect(crmCopy("de").labels.PROPERTY_TYPE_LABEL.land).toBe("Grundstück");
  expect(crmCopy("tr").labels.PROJECT_STATUS_LABEL.on_hold).toBe("On Hold");
  expect(crmCopy("fa").dict.tabs.board).toBeTruthy();
  expect(crmCopy("en").dict.board.newDeal).toBe("New Deal");
});
