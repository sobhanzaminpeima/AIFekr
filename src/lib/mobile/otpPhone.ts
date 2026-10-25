const PERSIAN = "۰۱۲۳۴۵۶۷۸۹", ARABIC = "٠١٢٣٤٥٦٧٨٩";

/**
 * Normalises what people type on a phone keyboard into the 09xxxxxxxxx form
 * the web OTP routes expect: Persian/Arabic digits, spaces and dashes, and
 * +98 / 0098 / 98 prefixes. Returns null for anything that is not an Iranian
 * mobile number, so the caller can answer 400 before touching the SMS gateway.
 */
export function normalizeIranMobile(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 32) return null;
  let digits = "";
  for (const ch of raw) {
    const p = PERSIAN.indexOf(ch), a = ARABIC.indexOf(ch);
    if (p >= 0) digits += p; else if (a >= 0) digits += a; else if (/[0-9]/.test(ch)) digits += ch;
    else if (!/[\s\-()+]/.test(ch)) return null;
  }
  if (digits.startsWith("0098")) digits = "0" + digits.slice(4);
  else if (digits.startsWith("98") && digits.length === 12) digits = "0" + digits.slice(2);
  else if (digits.startsWith("9") && digits.length === 10) digits = "0" + digits;
  return /^09[0-9]{9}$/.test(digits) ? digits : null;
}

/** OTP codes arrive the same way; keep only the digits, Persian or Latin. */
export function normalizeOtpCode(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 16) return null;
  let digits = "";
  for (const ch of raw) {
    const p = PERSIAN.indexOf(ch), a = ARABIC.indexOf(ch);
    if (p >= 0) digits += p; else if (a >= 0) digits += a; else if (/[0-9]/.test(ch)) digits += ch;
    else if (!/\s/.test(ch)) return null;
  }
  return /^[0-9]{4,6}$/.test(digits) ? digits : null;
}
