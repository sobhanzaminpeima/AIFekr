"use client";

import Link from "next/link";
import { Clock } from "lucide-react";
import { tri, type Lang } from "@/lib/i18n";

/**
 * Shown at the top of every dashboard page for an account with an active or
 * just-lapsed trial (User.trialEndsAt set — see /admin/invites). Purely
 * informational; the actual feature gating for the "limited" trial package
 * lives in each API route (see User.trialLimited in schema.prisma).
 */
export default function TrialBanner({ lang, trialEndsAt, trialLimited }: { lang: Lang; trialEndsAt: string; trialLimited: boolean }) {
  const endsAt = new Date(trialEndsAt);
  const msLeft = endsAt.getTime() - Date.now();
  const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));
  const expired = msLeft <= 0;

  return (
    <div
      className="flex flex-wrap items-center justify-center gap-2 px-4 py-2 text-xs md:text-sm text-center"
      style={{
        background: expired ? "rgba(239,68,68,0.12)" : "rgba(234,88,12,0.12)",
        color: expired ? "#ef4444" : "#ea580c",
        borderBottom: `1px solid ${expired ? "rgba(239,68,68,0.25)" : "rgba(234,88,12,0.25)"}`,
      }}
    >
      <Clock className="w-3.5 h-3.5 flex-shrink-0" />
      {expired ? (
        <span>
          {tri(
            lang,
            "این یک اکانت آزمایشی است و مدت آن به پایان رسیده — اطلاعات کسب‌وکار شما ذخیره شده و در صورت ارتقا به حساب حرفه‌ای بازگردانده می‌شود.",
            "This is a trial account and it has expired — your business data has been saved and will be restored if you upgrade to a paid plan.",
            "Dies ist ein Testkonto und die Testphase ist abgelaufen — Ihre Geschäftsdaten wurden gespeichert und werden bei einem Upgrade auf einen bezahlten Plan wiederhergestellt.",
            "Bu bir deneme hesabıdır ve süresi doldu — işletme bilgileriniz kaydedildi ve ücretli bir plana yükselttiğinizde geri yüklenecek."
          )}
        </span>
      ) : (
        <span>
          {tri(
            lang,
            trialLimited
              ? `این یک اکانت آزمایشی است — ${daysLeft} روز باقی‌مانده (ساخت ویدیو و طراحی وبسایت در این پکیج غیرفعال است)`
              : `این یک اکانت آزمایشی است — ${daysLeft} روز باقی‌مانده`,
            trialLimited
              ? `This is a trial account — ${daysLeft} days left (Video Generator and Website Designer are disabled in this package)`
              : `This is a trial account — ${daysLeft} days left`,
            trialLimited
              ? `Dies ist ein Testkonto — noch ${daysLeft} Tage (Video-Generator und Website-Designer sind in diesem Paket deaktiviert)`
              : `Dies ist ein Testkonto — noch ${daysLeft} Tage`,
            trialLimited
              ? `Bu bir deneme hesabıdır — ${daysLeft} gün kaldı (bu pakette Video Oluşturucu ve Web Sitesi Tasarımcısı devre dışı)`
              : `Bu bir deneme hesabıdır — ${daysLeft} gün kaldı`
          )}
        </span>
      )}
      <Link href="/plans" className="underline font-medium flex-shrink-0">
        {tri(lang, "ارتقا", "Upgrade", "Upgraden", "Yükselt")}
      </Link>
    </div>
  );
}
