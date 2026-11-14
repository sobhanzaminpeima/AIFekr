import { getSmsConfig } from "./config";
import { SMSIR_BULK_LIMIT, SmsError, smsirBulk, smsirVerify } from "./smsirApi";
import { ONESMS_BATCH_LIMIT, onesmsPattern, onesmsQuick } from "./onesmsApi";

const devMode = () => process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";

/**
 * The sign-in / sign-up code. With an approved verify template configured it
 * goes through the template (fast, no moderation); otherwise as plain text
 * from the line. Unconfigured in development, it is only logged.
 */
export async function sendOtpSms(phone: string, code: string): Promise<boolean> {
  const c = await getSmsConfig();
  if (!c.apiKey) {
    if (devMode()) { console.log(`[SMS DEV] OTP to ${phone}: ${code}`); return true; }
    return false;
  }
  try {
    const text = `کد ورود به آی‌فکر: ${code}\nاین کد تا ۵ دقیقه معتبر است.\nAiFekr.com`;
    if (c.provider === "onesms") {
      if (c.otpTemplateId) await onesmsPattern(c.apiKey, c.lineNumber, phone, c.otpTemplateId, { [c.otpParam]: code });
      else await onesmsQuick(c.apiKey, c.lineNumber, text, [phone]);
    } else if (c.otpTemplateId) await smsirVerify(c.apiKey, phone, c.otpTemplateId, { [c.otpParam]: code });
    else await smsirBulk(c.apiKey, c.lineNumber, text, [phone]);
    return true;
  } catch (e) {
    console.error("[sms] OTP send failed:", e instanceof SmsError ? `${e.code} ${e.message}` : e instanceof Error ? e.name : "unknown");
    return false;
  }
}

/** Plain text to any number of recipients, in provider-sized batches. A failing batch never stops the rest. */
export async function sendTextSms(mobiles: string[], text: string) {
  const c = await getSmsConfig();
  if (!c.apiKey || !c.lineNumber) throw new SmsError("NOT_CONFIGURED", "SMS key or line number is not set");
  let sent = 0, failed = 0, cost = 0;
  const errors: string[] = [];
  const limit = c.provider === "onesms" ? ONESMS_BATCH_LIMIT : SMSIR_BULK_LIMIT;
  for (let i = 0; i < mobiles.length; i += limit) {
    const batch = mobiles.slice(i, i + limit);
    try {
      if (c.provider === "onesms") {
        // onesms documents no per-number result: an accepted request counts its whole batch as sent.
        await onesmsQuick(c.apiKey, c.lineNumber, text, batch);
        sent += batch.length;
        continue;
      }
      const r = await smsirBulk(c.apiKey, c.lineNumber, text, batch);
      const ok = (r.messageIds ?? []).filter((id) => typeof id === "number" && id > 0).length;
      sent += ok; failed += batch.length - ok; cost += r.cost ?? 0;
    } catch (e) {
      failed += batch.length;
      errors.push(e instanceof SmsError ? `${e.code}: ${e.message}` : "request failed");
    }
  }
  return { sent, failed, cost, errors: [...new Set(errors)].slice(0, 5) };
}

/** Plain text to one number; for the old single-message callers. */
export async function sendSingleSms(mobile: string, text: string): Promise<boolean> {
  try { return (await sendTextSms([mobile], text)).sent === 1; } catch { return false; }
}
