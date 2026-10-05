import Link from "next/link";
import { getServerLang } from "@/lib/i18n/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import StudentWorkspace from "@/components/student/StudentWorkspace";
import { prisma } from "@/lib/db/prisma";
import { verifyToken } from "@/lib/auth/jwt";
import { isStudentWorkspaceEnabled } from "@/lib/student/access";

export const dynamic = "force-dynamic";

export default async function StudentPage() {
  const token = (await cookies()).get("token")?.value;
  const payload = token ? verifyToken(token) : null;
  if (!payload) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { id: true, isBlocked: true } });
  if (!user || user.isBlocked) redirect("/login");
  if (!await isStudentWorkspaceEnabled(user)) {
    const lang = await getServerLang();
    const t = (fa: string, en: string, de: string, tr: string) => ({ fa, en, de, tr })[lang];
    const pending = await prisma.payment.findFirst({ where: { userId: user.id, plan: { startsWith: "STUDENT_" }, gateway: "bank_transfer", status: "PENDING" }, orderBy: { createdAt: "desc" }, select: { id: true, receiptAt: true } });
    return <div className="mx-auto max-w-2xl p-6 sm:p-8" dir={lang === "fa" ? "rtl" : "ltr"}>
      <div className="rounded-3xl border p-6 sm:p-8" style={{ borderColor: "var(--border)", background: "var(--surface-1)" }}>
        <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>{pending?.receiptAt ? t("رسیدت ثبت شده؛ منتظر تأیید هستیم", "Receipt received · awaiting approval", "Beleg erhalten · Freigabe ausstehend", "Dekont alındı · onay bekleniyor") : pending ? t("خرید دانشجویی‌ات را ادامه بده", "Continue your student purchase", "Studierendenkauf fortsetzen", "Öğrenci satın alımına devam et") : t("فضای یادگیری تو از اینجا شروع می‌شود", "Your learning space starts here", "Dein Lernbereich beginnt hier", "Öğrenme alanın burada başlıyor")}</h1>
        <p className="mt-3 text-sm leading-7" style={{ color: "var(--text-secondary)" }}>{pending?.receiptAt ? t("نیازی به پرداخت دوباره نیست. وضعیت سفارش و نتیجهٔ بررسی را از دکمهٔ زیر ببین؛ پس از تأیید می‌توانی اولین درس را بسازی.", "No second payment is needed. Track your order below; create your first course after approval.", "Keine erneute Zahlung nötig. Verfolge deine Bestellung; nach Freigabe kannst du deinen ersten Kurs anlegen.", "Tekrar ödeme gerekmez. Siparişini aşağıdan takip et; onaydan sonra ilk dersini oluştur.") : t("پکیج دانشجویی را فعال کن، یک درس بساز و جزوه یا ویس کلاس را اضافه کن. اگر قبلاً پرداخت کرده‌ای، ابتدا تاریخچهٔ پرداخت‌ها را بررسی کن.", "Activate your student package, create a course and add notes or audio. If you already paid, check your payment history first.", "Aktiviere dein Studierendenpaket, erstelle einen Kurs und lade Material oder Audio hoch. Falls du schon bezahlt hast, prüfe zuerst deinen Zahlungsverlauf.", "Öğrenci paketini etkinleştir, ders oluştur ve not veya ses ekle. Daha önce ödediysen önce ödeme geçmişini kontrol et.")}</p>
        <Link href={pending ? `/checkout/${pending.id}` : "/plans?plan=STUDENT_FIRST_THREE_MONTHS&period=monthly"} className="mt-5 inline-flex min-h-12 items-center justify-center rounded-xl px-5 py-3 text-white" style={{ background: "var(--primary)" }}>{pending?.receiptAt ? t("پیگیری تأیید رسید", "Track receipt approval", "Belegfreigabe verfolgen", "Dekont onayını takip et") : pending ? t("ادامهٔ پرداخت و ارسال رسید", "Continue payment & receipt", "Zahlung und Beleg fortsetzen", "Ödeme ve dekonta devam et") : t("انتخاب پکیج دانشجویی", "Choose student package", "Studierendenpaket wählen", "Öğrenci paketi seç")}</Link>
        <Link href="/payments" className="mt-4 block text-sm underline" style={{ color: "var(--text-secondary)" }}>{t("تاریخچهٔ پرداخت‌ها", "Payment history", "Zahlungsverlauf", "Ödeme geçmişi")}</Link>
      </div>
    </div>;
  }
  return <StudentWorkspace />;
}
