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
      rewards: { id: string; title: string; status: string; packageChoice:string }[];
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
              <h3>{c.id.startsWith("play-launch-choice-")?t("مسابقهٔ رایگان آغاز AIFekr","AIFekr free launch competition","Kostenloser AIFekr-Startwettbewerb","Ücretsiz AIFekr açılış yarışması"):c.id.startsWith("play-daily-")?t("چالش روزانه","Daily challenge","Tages-Challenge","Günlük meydan okuma"):c.id.startsWith("play-weekly-")?t("چالش هفتگی","Weekly challenge","Wochen-Challenge","Haftalık meydan okuma"):c.title}</h3>
            <p>{c.id.startsWith("play-launch-choice-")?t("نفر اول یک ماه پکیج دانشجویی، فیتنس یا بیزنس را انتخاب می‌کند. خرید لازم نیست و امتیاز یا فرصت اضافه نمی‌دهد.","First place chooses one month Student, Fitness or Business. No purchase required; buying gives no extra attempts or points.","Platz eins wählt einen Monat Studium, Fitness oder Business. Kein Kauf nötig; ein Kauf gibt keine zusätzlichen Versuche oder Punkte.","Birinci, bir ay Öğrenci, Fitness veya İşletme seçer. Satın alma gerekmez; ek deneme veya puan sağlamaz."):c.description}</p>
            <small>
              {new Date(c.endsAt).toLocaleString(lang)} · {c.maxAttempts}{" "}
              {t(
                "فرصت رایگان",
                "free attempts",
                "kostenlose Versuche",
                "ücretsiz deneme",
              )}
            </small>
            {c.rewardTitle && <p>🏆 {c.rewardTitle==="MONTHLY_PACKAGE_CHOICE"?t("یک ماه دانشجویی، فیتنس یا بیزنس به انتخاب برنده","Winner chooses one month Student, Fitness or Business","Ein Monat Studium, Fitness oder Business nach Wahl","Kazanan bir ay Öğrenci, Fitness veya İşletme seçer"):c.rewardTitle}</p>}
            <details>
              <summary>{t("قوانین", "Rules", "Regeln", "Kurallar")}</summary>
                  <p>{c.id.startsWith("play-launch-choice-")?t("ورود رایگان؛ سه فرصت برای هر نفر. بیشترین امتیاز تأییدشدهٔ سرور برنده است. در تساوی، نتیجهٔ زودتر و سپس شناسهٔ بازی ملاک است. فقط نفر اول یک ماه پکیج دانشجویی، فیتنس یا بیزنس را انتخاب می‌کند. نتیجه پس از بررسی تقلب توسط ادمین تأیید و جایزه تحویل می‌شود. خرید هیچ مزیتی ندارد. جایزه نقدی ندارد.","Free entry, three attempts per person. Highest server-verified score wins; ties use earliest result then session ID. One first-place winner chooses a one-month Student, Fitness or Business package. Admin reviews results for abuse before approval and delivery. Buying gives no advantage. No cash prize.","Kostenlos, drei Versuche pro Person. Höchster servergeprüfter Punktestand gewinnt; bei Gleichstand frühestes Ergebnis, dann Sitzungs-ID. Ein Erstplatzierter wählt einen Monat Studium, Fitness oder Business. Admin prüft Missbrauch vor Bestätigung und Lieferung. Kein Kaufvorteil, kein Geldpreis.","Ücretsiz, kişi başı üç deneme. En yüksek sunucu doğrulamalı puan kazanır; eşitlikte erken sonuç, sonra oturum kimliği. Bir birinci bir ay Öğrenci, Fitness veya İşletme seçer. Yönetici sonuçları kötüye kullanım için inceler, onaylar ve ödülü teslim eder. Satın alma avantajı ve nakit ödül yok."):c.id.startsWith("play-daily-")||c.id.startsWith("play-weekly-")?t("ورود رایگان؛ سه فرصت. بیشترین امتیاز تأییدشده برنده است. در تساوی، نتیجه زودتر و سپس شناسه بازی ملاک است. زمان‌ها UTC هستند. بدون خرید و جایزه نقدی.","Free entry; three attempts. Highest verified score wins. Ties use earliest result, then session ID. Dates use UTC. No purchase or cash prize.","Kostenlos; drei Versuche. Höchster geprüfter Punktestand gewinnt. Bei Gleichstand zählt das früheste Ergebnis, danach die Sitzungs-ID. UTC. Kein Kauf oder Geldpreis.","Ücretsiz; üç deneme. En yüksek doğrulanmış puan kazanır. Eşitlikte önce erken sonuç, sonra oturum kimliği geçerlidir. UTC. Satın alma veya nakit ödül yok."):c.terms}</p>
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
          🏆 {r.title==="MONTHLY_PACKAGE_CHOICE"?t("یک ماه پکیج به انتخاب شما","One month of your chosen package","Ein Monat Ihres Wunschpakets","Seçtiğiniz pakette bir ay"):r.title} ·{" "}
          {r.status === "FULFILLED"
            ? t("تحویل شد", "Delivered", "Geliefert", "Teslim edildi")
            : t(
                "تأییدشده؛ در انتظار تحویل",
                "Approved; awaiting delivery",
                "Bestätigt; Lieferung ausstehend",
                "Onaylandı; teslimat bekleniyor",
              )}
          {r.title==="MONTHLY_PACKAGE_CHOICE"&&r.status==="APPROVED"&&!r.packageChoice&&<select aria-label={t("انتخاب جایزه","Choose reward","Prämie wählen","Ödül seçin")} defaultValue="" onChange={async e=>{const choice=e.target.value;if(!choice)return;const response=await fetch("/api/play/rewards",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:r.id,choice})});if(response.ok)setData(current=>current?{...current,rewards:current.rewards.map(x=>x.id===r.id?{...x,packageChoice:choice}:x)}:current);else setError(t("انتخاب ذخیره نشد","Could not save choice","Auswahl nicht gespeichert","Seçim kaydedilemedi"));}}><option value="" disabled>{t("انتخاب پکیج جایزه","Choose your package","Paket auswählen","Paketinizi seçin")}</option><option value="STUDENT">{t("دانشجویی","Student","Studium","Öğrenci")}</option><option value="FITNESS">{t("فیتنس","Fitness","Fitness","Fitness")}</option><option value="BUSINESS">{t("بیزنس","Business","Business","İşletme")}</option></select>}
          {r.packageChoice&&<span> · {({STUDENT:t("دانشجویی","Student","Studium","Öğrenci"),FITNESS:t("فیتنس","Fitness","Fitness","Fitness"),BUSINESS:t("بیزنس","Business","Business","İşletme")} as Record<string,string>)[r.packageChoice]}</span>}
        </p>
      ))}
    </section>
  );
}
