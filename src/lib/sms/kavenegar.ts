const API_KEY = process.env.KAVENEGAR_API_KEY || "";
const SENDER = process.env.KAVENEGAR_SENDER || "10008566";
const hasKavenegar = !!(API_KEY && API_KEY !== "your-kavenegar-key");

export async function sendSMS(receptor: string, message: string): Promise<boolean> {
  if (!hasKavenegar) {
    console.log(`[SMS DEV] To: ${receptor} | Message: ${message}`);
    return true;
  }

  const url = `https://api.kavenegar.com/v1/${API_KEY}/sms/send.json`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ receptor, sender: SENDER, message }),
  });

  const data = await res.json();
  return data.return?.status === 200;
}

export async function sendOTP(phone: string, code: string): Promise<boolean> {
  const message = `کد تأیید هوشمند AI:\n${code}\n\nاین کد ۱۰ دقیقه معتبر است.`;
  return sendSMS(phone, message);
}

export async function sendLookup(
  receptor: string,
  template: string,
  tokens: Record<string, string>
): Promise<boolean> {
  if (!hasKavenegar) {
    console.log(`[SMS DEV] Lookup - To: ${receptor} | Template: ${template} | Tokens:`, tokens);
    return true;
  }

  const url = `https://api.kavenegar.com/v1/${API_KEY}/verify/lookup.json`;
  const params = new URLSearchParams({ receptor, template });
  Object.entries(tokens).forEach(([k, v]) => params.append(k, v));

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });

  const data = await res.json();
  return data.return?.status === 200;
}
