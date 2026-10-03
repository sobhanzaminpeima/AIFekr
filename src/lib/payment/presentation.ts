export type BankDetails = { iban: string; holder: string };

export function readBankDetails(snapshot: string | null): BankDetails | null {
  try {
    const bank: unknown = JSON.parse(snapshot || "");
    if (!bank || typeof bank !== "object" || !("iban" in bank) || !("holder" in bank)) return null;
    if (typeof bank.iban !== "string" || typeof bank.holder !== "string" || !bank.iban.trim() || !bank.holder.trim()) return null;
    return { iban: bank.iban.replace(/\s/g, "").toUpperCase(), holder: bank.holder };
  } catch { return null; }
}

export function formatIban(iban: string): string {
  return iban.replace(/\s/g, "").toUpperCase().match(/.{1,4}/g)?.join(" ") || "";
}

export function receiptFileError(file: File): "size" | "type" | null {
  if (file.size > 5 * 1024 * 1024) return "size";
  if (!["image/jpeg", "image/png", "application/pdf"].includes(file.type)) return "type";
  return null;
}
