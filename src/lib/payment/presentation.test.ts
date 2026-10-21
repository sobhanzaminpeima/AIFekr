import { describe, expect, it } from "vitest";
import { formatIban, readBankDetails, receiptFileError } from "./presentation";

describe("bank checkout presentation", () => {
  it("groups an IBAN without changing its copyable value", () => {
    const bank = readBankDetails('{"iban":"tr21 0001 0090 1058 3132 1050 01","holder":"Example"}');
    expect(bank?.iban).toBe("TR210001009010583132105001");
    expect(formatIban(bank!.iban)).toBe("TR21 0001 0090 1058 3132 1050 01");
  });
  it.each([null, "", "broken", "null", "{}", '{"iban":2,"holder":"Example"}'])("handles incomplete bank snapshots safely: %s", snapshot => {
    expect(readBankDetails(snapshot)).toBeNull();
  });
  it("rejects oversized and unsupported receipts before upload", () => {
    expect(receiptFileError(new File(["x"], "receipt.exe", { type: "application/octet-stream" }))).toBe("type");
    expect(receiptFileError(new File([new Uint8Array(5 * 1024 * 1024 + 1)], "receipt.pdf", { type: "application/pdf" }))).toBe("size");
    expect(receiptFileError(new File(["x"], "receipt.pdf", { type: "application/pdf" }))).toBeNull();
  });
});
