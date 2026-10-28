"use client";
import { useEffect, useState } from "react";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { tri, useTranslation } from "@/lib/i18n";
import { growthEvent } from "./GrowthTracker";

type Rec = { planCode: string; name: string; nameEn: string; priceToman: number | null; priceUsdCents: number | null; durationDays: number; credits: number; checkoutUrl: string };
type Data = { enabled: boolean; currentPlan?: string; credits?: number; recommendation?: Rec | null };
export type UpgradeReason = "plan_required" | "first_success" | "low_credits";

/**
 * Contextual upgrade suggestion. Everything shown comes from /api/growth/upgrade,
 * which reads the Package table; nothing is invented and nothing is charged here --
 * the button only opens the existing checkout.
 */
export default function UpgradeCard({ moduleId, reason, onBeforeCheckout }: { moduleId: string; reason: UpgradeReason; onBeforeCheckout?: () => void }) {
  const { lang } = useTranslation(), t = (fa: string, en: string, de: string, tr: string) => tri(lang, fa, en, de, tr);
  const [data, setData] = useState<Data | null>(null);
  useEffect(() => {
    let live = true;
    fetch(`/api/growth/upgrade?module=${encodeURIComponent(moduleId)}`, { cache: "no-store" }).then(r => r.ok ? r.json() : null).then((d: Data | null) => {
      if (!live || !d) return;
      setData(d);
      if (d.enabled && d.recommendation) growthEvent("upgrade_prompt_viewed", { moduleId, metadata: { reason, plan: d.recommendation.planCode }, key: `upv:${moduleId}:${reason}:${new Date().toISOString().slice(0, 10)}` });
    }).catch(() => {});
    return () => { live = false; };
  }, [moduleId, reason]);
  const rec = data?.recommendation;
  if (!data?.enabled || !rec) return null;
  const price = rec.priceToman != null ? `${rec.priceToman.toLocaleString(lang)} ${t("تومان", "Toman", "Toman", "Toman")}` : rec.priceUsdCents != null ? `$${(rec.priceUsdCents / 100).toFixed(2)}` : null;
  const title = reason === "first_success" ? t("اولین صدای شما آماده شد", "Your first voice is ready", "Ihre erste Stimme ist fertig", "İlk sesiniz hazır")
    : reason === "low_credits" ? t("برای تولید بعدی کردیت کافی ندارید", "Not enough credits for the next generation", "Nicht genug Credits für die nächste Generierung", "Sonraki üretim için yeterli kredi yok")
    : t("برای ادامه، یک پلن مناسب لازم است", "A suitable plan is needed to continue", "Für mehr ist ein passendes Paket nötig", "Devam etmek için uygun bir paket gerekir");
  return <section className="vs-card vs-upgrade" aria-label={t("پیشنهاد پلن", "Plan suggestion", "Paketvorschlag", "Paket önerisi")}>
    <div className="vs-card-head"><Sparkles size={18} className="vs-accent"/><div><h2>{title}</h2><p>{t("برای ساخت صداهای بیشتر و طولانی‌تر، این پلن را ببینید.", "See this plan for more and longer voiceovers.", "Mit diesem Paket erstellen Sie mehr und längere Sprachaufnahmen.", "Daha fazla ve daha uzun seslendirme için bu pakete bakın.")}</p></div></div>
    <dl className="vs-summary">
      <div><dt>{t("پلن فعلی", "Current plan", "Aktuelles Paket", "Mevcut paket")}</dt><dd>{data.currentPlan}</dd></div>
      <div><dt>{t("کردیت باقی‌مانده", "Credits left", "Verbleibende Credits", "Kalan kredi")}</dt><dd>{(data.credits ?? 0).toLocaleString(lang)}</dd></div>
      <div><dt>{t("پلن پیشنهادی", "Suggested plan", "Empfohlenes Paket", "Önerilen paket")}</dt><dd><strong>{lang === "fa" ? rec.name : rec.nameEn}</strong></dd></div>
      {price && <div><dt>{t("قیمت", "Price", "Preis", "Fiyat")}</dt><dd>{price} / {rec.durationDays.toLocaleString(lang)} {t("روز", "days", "Tage", "gün")}</dd></div>}
      <div><dt>{t("کردیت همراه پلن", "Included credits", "Enthaltene Credits", "Dahil kredi")}</dt><dd>{rec.credits.toLocaleString(lang)}</dd></div>
    </dl>
    <a className="vs-primary" href={rec.checkoutUrl} onClick={() => { onBeforeCheckout?.(); growthEvent("upgrade_prompt_clicked", { moduleId, metadata: { reason, plan: rec.planCode } }); }}>{t("مشاهده و خرید پلن", "View and buy plan", "Paket ansehen und kaufen", "Paketi gör ve satın al")}<ArrowUpRight size={18}/></a>
    <p className="vs-muted vs-fineprint">{t("پرداخت فقط با تأیید شما در صفحهٔ پرداخت انجام می‌شود و بعد از آن به همین‌جا برمی‌گردید.", "Payment only happens after you confirm it on the checkout page, and you come back here afterwards.", "Bezahlt wird erst nach Ihrer Bestätigung im Checkout; danach kehren Sie hierher zurück.", "Ödeme yalnızca ödeme sayfasında onayınızla yapılır, ardından buraya dönersiniz.")}</p>
  </section>;
}
