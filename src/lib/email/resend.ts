import { Resend } from "resend";

const hasResend = !!(process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== "re_your-key-here");
const resend = hasResend ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.RESEND_FROM || "noreply@example.com";
const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "هوشمند AI";

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!resend) {
    console.log(`[EMAIL DEV] To: ${to} | Subject: ${subject}`);
    return true;
  }

  const { error } = await resend.emails.send({ from: `${APP_NAME} <${FROM}>`, to, subject, html });
  if (error) { console.error("Resend error:", error); return false; }
  return true;
}

export async function sendWelcomeEmail(to: string, name: string): Promise<boolean> {
  return sendEmail(
    to,
    `خوش آمدید به ${APP_NAME}`,
    `<div dir="rtl" style="font-family:Tahoma;padding:24px;">
      <h2>سلام ${name}!</h2>
      <p>به <strong>${APP_NAME}</strong> خوش آمدید.</p>
      <p>می‌توانید همین الان از قابلیت‌های هوش مصنوعی استفاده کنید.</p>
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/chat"
         style="display:inline-block;padding:12px 24px;background:#ea580c;color:white;border-radius:8px;text-decoration:none;">
        شروع کنید
      </a>
    </div>`
  );
}

export async function sendPaymentConfirmEmail(
  to: string,
  name: string,
  plan: string,
  amount: number,
  refId: string
): Promise<boolean> {
  return sendEmail(
    to,
    `تأیید خرید اشتراک ${plan} — ${APP_NAME}`,
    `<div dir="rtl" style="font-family:Tahoma;padding:24px;">
      <h2>خرید شما با موفقیت انجام شد ✅</h2>
      <p>سلام ${name}،</p>
      <p>اشتراک <strong>${plan}</strong> شما فعال شد.</p>
      <table style="border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:8px;color:#666;">مبلغ:</td><td style="padding:8px;font-weight:bold;">${amount.toLocaleString()} تومان</td></tr>
        <tr><td style="padding:8px;color:#666;">کد پیگیری:</td><td style="padding:8px;font-weight:bold;">${refId}</td></tr>
      </table>
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/chat"
         style="display:inline-block;padding:12px 24px;background:#ea580c;color:white;border-radius:8px;text-decoration:none;">
        استفاده از اشتراک
      </a>
    </div>`
  );
}
