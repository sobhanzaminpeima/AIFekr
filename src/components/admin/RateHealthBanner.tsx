import Link from "next/link";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n/tri";
import { rateHealth } from "@/lib/billing/rateHealth";

/** The first few package codes; the count is already in the sentence. */
const list = (codes: string[], sep: string) => codes.slice(0, 6).join(sep) + (codes.length > 6 ? sep + "…" : "");
const NAMES = { IRT: ["تومان", "Toman", "Toman", "Toman"], TRY: ["لیر", "Lira", "Lira", "Lira"], EUR: ["یورو", "Euro", "Euro", "Euro"] } as const;

/**
 * Admin-wide warning when an approved exchange rate has expired or expires
 * within 48 hours, with the packages a buyer could not pay for until a new
 * rate is approved. Rates expired on 2026-10-18 without anyone noticing.
 */
export default async function RateHealthBanner() {
  const rows = (await rateHealth().catch(() => [])).filter((r) => r.status !== "ok");
  if (!rows.length) return null;
  const lang = await getServerLang();
  const t = (fa: string, en: string, de: string, tr: string) => tri(lang, fa, en, de, tr);
  const date = (d: Date) => new Intl.DateTimeFormat(lang === "fa" ? "fa-IR-u-ca-persian" : lang, { dateStyle: "medium", timeStyle: "short" }).format(d);
  const blocking = rows.some((r) => r.status === "expired" && r.blocked.length);
  return (
    <div role="alert" style={{ margin: "12px 16px 0", padding: "12px 16px", borderRadius: 12, border: `1px solid ${blocking ? "#ef4444" : "#ff6b00"}`, background: blocking ? "#ef44441a" : "#ff6b001a", color: "var(--text-primary)", fontSize: 13, lineHeight: 1.9 }}>
      {rows.map((r) => {
        const [fa, en, de, tr] = NAMES[r.target], name = tri(lang, fa, en, de, tr);
        const when = r.validUntil ? date(r.validUntil) : t("هرگز ثبت نشده", "never set", "nie gesetzt", "hiç girilmedi");
        return (
          <p key={r.target} style={{ margin: 0 }}>
            <strong>
              {r.status === "expired"
                ? t(`نرخ تأییدشدهٔ ${name} منقضی شده است (${when}).`, `The approved ${name} rate has expired (${when}).`, `Der genehmigte ${name}-Kurs ist abgelaufen (${when}).`, `Onaylı ${name} kuru süresi doldu (${when}).`)
                : t(`نرخ تأییدشدهٔ ${name} تا ${when} معتبر است.`, `The approved ${name} rate is valid until ${when}.`, `Der genehmigte ${name}-Kurs gilt bis ${when}.`, `Onaylı ${name} kuru ${when} tarihine kadar geçerli.`)}
            </strong>{" "}
            {r.blocked.length
              ? t(`${r.blocked.length.toLocaleString("fa-IR")} پکیج منتشرشده قیمت ثابت ${name} ندارند و بدون نرخ معتبر قابل خرید نیستند: ${list(r.blocked, "، ")}.`, `${r.blocked.length} published packages have no fixed ${name} price and cannot be bought without a valid rate: ${list(r.blocked, ", ")}.`, `${r.blocked.length} veröffentlichte Pakete haben keinen festen ${name}-Preis: ${list(r.blocked, ", ")}.`, `${r.blocked.length} yayınlanmış paketin sabit ${name} fiyatı yok: ${list(r.blocked, ", ")}.`)
              : t(`همهٔ پکیج‌های منتشرشده قیمت ثابت ${name} دارند؛ خرید فعلاً به این نرخ وابسته نیست.`, `Every published package has a fixed ${name} price, so purchases don't depend on this rate right now.`, `Alle veröffentlichten Pakete haben einen festen ${name}-Preis.`, `Tüm yayınlanmış paketlerin sabit ${name} fiyatı var.`)}
          </p>
        );
      })}
      <Link href="/admin/billing/rates" style={{ color: "var(--orange, #ff6b00)", fontWeight: 600 }}>
        {t("ثبت و تأیید نرخ جدید", "Approve a new rate", "Neuen Kurs genehmigen", "Yeni kur onayla")}
      </Link>
    </div>
  );
}
