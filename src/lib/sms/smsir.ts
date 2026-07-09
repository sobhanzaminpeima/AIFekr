const API_KEY = process.env.SMSIR_API_KEY || "";
const LINE_NUMBER = process.env.SMSIR_LINE_NUMBER || "";
const hasSmsIr = !!(API_KEY && LINE_NUMBER);

const BASE = "https://api.sms.ir/v1";

export async function sendSMS(receptor: string, message: string): Promise<boolean> {
  if (!hasSmsIr) {
    console.log(`[SMS DEV] To: ${receptor} | Message: ${message}`);
    return true;
  }

  const res = await fetch(`${BASE}/send/bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-KEY": API_KEY },
    body: JSON.stringify({
      lineNumber: Number(LINE_NUMBER),
      messageText: message,
      mobiles: [receptor],
    }),
  });

  const data = await res.json();
  return data.status === 1;
}

export async function sendOTP(phone: string, code: string): Promise<boolean> {
  const message = `کد تأیید هوشمند AI:\n${code}\n\nاین کد ۱۰ دقیقه معتبر است.`;
  return sendSMS(phone, message);
}
