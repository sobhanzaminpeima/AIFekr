"use client";
import { useEffect, useState } from "react";
import { useTranslation, tri } from "@/lib/i18n";
import type { GameSlug } from "@/lib/play/engine";
type Competition = {
  id: string;
  title: string;
  description: string;
  gameSlug: GameSlug;
  status: string;
  startsAt: string;
  endsAt: string;
  maxAttempts: number;
  rewardTitle: string;
  terms: string;
};
export default function Competitions({
  onPlay,
  disabled,
}: {
  onPlay: (game: GameSlug, id: string) => void;
  disabled: boolean;
}) {
  const { lang } = useTranslation(),
    t = (fa: string, en: string, de: string, tr: string) =>
      tri(lang, fa, en, de, tr),
    [data, setData] = useState<{
      tournaments: Competition[];
      rewards: { id: string; title: string; status: string }[];
    }>(),
    [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/play/competitions", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw Error("LOAD_FAILED");
        setData(await r.json());
      })
      .catch(() =>
        setError(
          tri(lang,
            "مسابقه‌ها بارگذاری نشدند",
            "Could not load competitions",
            "Wettbewerbe konnten nicht geladen werden",
            "Yarışmalar yüklenemedi",
          ),
        ),
      );
  }, [lang]);
  return (
    <section className="play-panel">
      <h2>
        {t(
          "مسابقه‌ها و پاداش‌ها",
          "Competitions & rewards",
          "Wettbewerbe und Prämien",
          "Yarışmalar ve ödüller",
        )}
      </h2>
      {error && <p role="alert">{error}</p>}
      {data?.tournaments.length === 0 && (
        <p>
          {t(
            "مسابقه‌های بعدی اینجا نمایش داده می‌شوند.",
            "Upcoming competitions will appear here.",
            "Kommende Wettbewerbe erscheinen hier.",
            "Yaklaşan yarışmalar burada görünür.",
          )}
        </p>
      )}
      <div className="play-competition-grid">
        {data?.tournaments.map((c) => (
          <article key={c.id}>
              <h3>{c.id.startsWith("play-daily-")?t("چالش روزانه","Daily challenge","Tages-Challenge","Günlük meydan okuma"):c.id.startsWith("play-weekly-")?t("چالش هفتگی","Weekly challenge","Wochen-Challenge","Haftalık meydan okuma"):c.title}</h3>
            <p>{c.description}</p>
            <small>
              {new Date(c.endsAt).toLocaleString(lang)} · {c.maxAttempts}{" "}
              {t(
                "فرصت رایگان",
                "free attempts",
                "kostenlose Versuche",
                "ücretsiz deneme",
              )}
            </small>
            {c.rewardTitle && <p>🏆 {c.rewardTitle}</p>}
            <details>
              <summary>{t("قوانین", "Rules", "Regeln", "Kurallar")}</summary>
                  <p>{c.id.startsWith("play-daily-")||c.id.startsWith("play-weekly-")?t("ورود رایگان؛ سه فرصت. بیشترین امتیاز تأییدشده برنده است. در تساوی، نتیجه زودتر و سپس شناسه بازی ملاک است. زمان‌ها UTC هستند. بدون خرید و جایزه نقدی.","Free entry; three attempts. Highest verified score wins. Ties use earliest result, then session ID. Dates use UTC. No purchase or cash prize.","Kostenlos; drei Versuche. Höchster geprüfter Punktestand gewinnt. Bei Gleichstand zählt das früheste Ergebnis, danach die Sitzungs-ID. UTC. Kein Kauf oder Geldpreis.","Ücretsiz; üç deneme. En yüksek doğrulanmış puan kazanır. Eşitlikte önce erken sonuç, sonra oturum kimliği geçerlidir. UTC. Satın alma veya nakit ödül yok."):c.terms}</p>
            </details>
            <button
              disabled={
                disabled ||
                c.status !== "PUBLISHED" ||
                new Date(c.startsAt) > new Date() ||
                new Date(c.endsAt) <= new Date()
              }
              onClick={() => onPlay(c.gameSlug, c.id)}
            >
              {t(
                "شرکت در مسابقه",
                "Join competition",
                "Teilnehmen",
                "Yarışmaya katıl",
              )}
            </button>
          </article>
        ))}
      </div>
      {data?.rewards.map((r) => (
        <p key={r.id}>
          🏆 {r.title} ·{" "}
          {r.status === "FULFILLED"
            ? t("تحویل شد", "Delivered", "Geliefert", "Teslim edildi")
            : t(
                "تأییدشده؛ در انتظار تحویل",
                "Approved; awaiting delivery",
                "Bestätigt; Lieferung ausstehend",
                "Onaylandı; teslimat bekleniyor",
              )}
        </p>
      ))}
    </section>
  );
}
