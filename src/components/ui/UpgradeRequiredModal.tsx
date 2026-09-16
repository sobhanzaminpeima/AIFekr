"use client";

import Link from "next/link";
import { Lock, X } from "lucide-react";
import { tri, type Lang } from "@/lib/i18n";

/**
 * Shown instead of a toast when a referral-trial account (User.trialLimited)
 * hits a blocked feature (Video Generator, Website Designer) -- a toast is
 * easy to miss and gives no path forward; this blocks the screen and links
 * straight to upgrading.
 */
export default function UpgradeRequiredModal({ lang, onClose }: { lang: Lang; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div
        className="relative w-full max-w-sm rounded-2xl p-6 text-center"
        style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-3 end-3" style={{ color: "var(--text-muted)" }}>
          <X className="w-4 h-4" />
        </button>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(234,88,12,0.15)" }}>
          <Lock className="w-6 h-6" style={{ color: "#ea580c" }} />
        </div>
        <h3 className="font-bold mb-2" style={{ color: "var(--text-primary)" }}>
          {tri(lang, "این بخش نیاز به ارتقای حساب دارد", "This feature requires an upgraded account", "Diese Funktion erfordert ein Upgrade Ihres Kontos", "Bu özellik hesap yükseltmesi gerektirir")}
        </h3>
        <p className="text-sm mb-5" style={{ color: "var(--text-secondary)" }}>
          {tri(
            lang,
            "برای استفاده از این بخش باید اکانت خود را ارتقا دهید — بقیه امکانات همچنان در دسترس شماست.",
            "You need to upgrade your account to use this feature — everything else stays available to you.",
            "Sie müssen Ihr Konto upgraden, um diese Funktion nutzen zu können — alle anderen Funktionen bleiben verfügbar.",
            "Bu özelliği kullanmak için hesabınızı yükseltmeniz gerekiyor — diğer tüm özellikler kullanılabilir kalır."
          )}
        </p>
        <Link
          href="/plans"
          className="block w-full py-2.5 rounded-xl text-sm font-semibold text-white"
          style={{ background: "linear-gradient(135deg, #ea580c, #f97316)" }}
        >
          {tri(lang, "ارتقای حساب", "Upgrade account", "Konto upgraden", "Hesabı yükselt")}
        </Link>
      </div>
    </div>
  );
}
