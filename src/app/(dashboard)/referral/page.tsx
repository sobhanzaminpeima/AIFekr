"use client";

import { useEffect, useState } from "react";
import { Gift, Copy, Check, Users, Coins } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { formatNumber } from "@/lib/utils/jalali";

interface ReferralData {
  referralCode: string | null;
  invitedCount: number;
  creditsEarned: number;
  bonusPerReferral: number;
}

export default function ReferralPage() {
  const { lang } = useTranslation();
  const isFa = lang !== "en";
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/referral/me")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const link = data?.referralCode && typeof window !== "undefined"
    ? `${window.location.origin}/register?ref=${data.referralCode}`
    : "";

  async function copyLink() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: "var(--surface-0)" }}>
        <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6" style={{ background: "var(--surface-0)" }} dir={isFa ? "rtl" : "ltr"}>
      <div className="max-w-2xl mx-auto">

        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "rgba(16,185,129,0.15)" }}>
            <Gift className="w-6 h-6" style={{ color: "#10b981" }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
              {isFa ? "دعوت کن، اعتبار بگیر" : "Invite & Earn"}
            </h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {isFa
                ? `به ازای هر دوست که با لینک تو ثبت‌نام و خرید کند، ${formatNumber(data?.bonusPerReferral ?? 100, lang)} اعتبار رایگان می‌گیرید — هر دوی شما.`
                : `Both you and your friend get ${data?.bonusPerReferral ?? 100} free credits when they sign up with your link and make their first purchase.`}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4" style={{ color: "var(--primary)" }} />
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>{isFa ? "دعوت‌شدگان" : "Invited"}</span>
            </div>
            <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{formatNumber(data?.invitedCount ?? 0, lang)}</p>
          </div>
          <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2 mb-2">
              <Coins className="w-4 h-4" style={{ color: "#10b981" }} />
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>{isFa ? "اعتبار کسب‌شده" : "Credits earned"}</span>
            </div>
            <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{formatNumber(data?.creditsEarned ?? 0, lang)}</p>
          </div>
        </div>

        {/* Referral link */}
        <div className="rounded-2xl p-5" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
            {isFa ? "لینک دعوت شما" : "Your invite link"}
          </label>
          <div className="flex gap-2">
            <input
              readOnly
              value={link}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            />
            <button
              onClick={copyLink}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white flex-shrink-0"
              style={{ background: copied ? "#10b981" : "var(--primary)" }}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? (isFa ? "کپی شد" : "Copied") : (isFa ? "کپی" : "Copy")}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
