"use client";
import { useCallback, useEffect, useState } from "react";
import { useTranslation, tri } from "@/lib/i18n";
type Tournament = {
  id: string;
  title: string;
  gameSlug: string;
  status: string;
  startsAt: string;
  endsAt: string;
  results: string;
  _count: { entries: number };
};
type Reward = { id: string; title: string; status: string; userId: string;packageChoice:string };
export default function CompetitionManager() {
  const { lang } = useTranslation(),
    t = (fa: string, en: string, de: string, tr: string) =>
      tri(lang, fa, en, de, tr),
    [tournaments, setTournaments] = useState<Tournament[]>([]),
    [rewards, setRewards] = useState<Reward[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [form, setForm] = useState({
      title: "",
      description: "",
      gameSlug: "tower",
      startsAt: "",
      endsAt: "",
      maxAttempts: 3,
      maxParticipants: 1000,
      rewardTitle: "",
      terms: "",
    });
  const load = useCallback(async () => {
    const r = await fetch("/api/admin/play/competitions"),
      d = await r.json();
    if (!r.ok) throw Error(d.error);
    setTournaments(d.tournaments);
    setRewards(d.rewards);
  }, []);
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);
  async function command(body: unknown) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/admin/play/competitions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
        d = await r.json();
      if (!r.ok) throw Error(d.error);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ERROR");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-4">
      <h2 className="font-semibold">
        {t(
          "مسابقه رایگان و پاداش",
          "Free competitions & rewards",
          "Kostenlose Wettbewerbe und Prämien",
          "Ücretsiz yarışmalar ve ödüller",
        )}
      </h2>
      {error && (
        <p role="alert" className="text-red-500">
          {error}
        </p>
      )}
      <details className="border rounded-2xl p-4">
        <summary>
          {t(
            "ساخت مسابقه",
            "Create competition",
            "Wettbewerb erstellen",
            "Yarışma oluştur",
          )}
        </summary>
        <form
          className="grid sm:grid-cols-2 gap-3 mt-4"
          onSubmit={(e) => {
            e.preventDefault();
            void command({
              action: "create",
              configuration: {
                ...form,
                startsAt: new Date(form.startsAt).toISOString(),
                endsAt: new Date(form.endsAt).toISOString(),
              },
            });
          }}
        >
          {(
            [
              ["title", t("عنوان", "Title", "Titel", "Başlık")],
              [
                "description",
                t("توضیحات", "Description", "Beschreibung", "Açıklama"),
              ],
              [
                "rewardTitle",
                t(
                  "پاداش تبلیغاتی اختیاری",
                  "Optional promotional reward",
                  "Optionale Werbeprämie",
                  "İsteğe bağlı promosyon ödülü",
                ),
              ],
              [
                "terms",
                t(
                  "قوانین منتشرشده",
                  "Published rules",
                  "Veröffentlichte Regeln",
                  "Yayımlanan kurallar",
                ),
              ],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="text-sm">
              {label}
              <input
                required={key !== "rewardTitle"}
                minLength={key === "terms" ? 20 : key === "title" ? 3 : 0}
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                className="block w-full rounded-xl border bg-transparent p-3"
              />
            </label>
          ))}
          <button type="button" className="border rounded-xl p-3" onClick={()=>setForm({...form,rewardTitle:"MONTHLY_PACKAGE_CHOICE"})}>{t("جایزه: یک ماه دانشجویی، فیتنس یا بیزنس به انتخاب برنده","Prize: winner chooses one month Student, Fitness or Business","Prämie: ein Monat Studium, Fitness oder Business nach Wahl","Ödül: kazanan bir ay Öğrenci, Fitness veya İşletme seçer")}</button>
          <select
            value={form.gameSlug}
            onChange={(e) => setForm({ ...form, gameSlug: e.target.value })}
            className="border rounded-xl bg-transparent p-3"
          >
            {["tower", "snake", "2048", "speed-run", "fiko-fly"].map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
          {(["startsAt", "endsAt"] as const).map((key) => (
            <label key={key}>
              {key}
              <input
                required
                type="datetime-local"
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                className="block border rounded-xl bg-transparent p-3"
              />
            </label>
          ))}
          {(["maxAttempts", "maxParticipants"] as const).map((key) => (
            <label key={key}>
              {key}
              <input
                type="number"
                min="1"
                max={key === "maxAttempts" ? 10 : 10000}
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: +e.target.value })}
                className="block border rounded-xl bg-transparent p-3"
              />
            </label>
          ))}
          <button
            disabled={busy}
            className="rounded-xl bg-orange-600 px-4 py-3 text-white"
          >
            {t(
              "ذخیره پیش‌نویس",
              "Save draft",
              "Entwurf speichern",
              "Taslak kaydet",
            )}
          </button>
        </form>
      </details>
      {tournaments.map((row) => (
        <article className="border rounded-2xl p-4 space-y-3" key={row.id}>
          <h3>{row.title}</h3>
          <p className="text-xs opacity-70">
            {row.gameSlug} · {row.status} · {row._count.entries}
          </p>
          <div className="flex flex-wrap gap-2">
            {(row.status === "DRAFT"
              ? ["publish", "archive"]
              : row.status === "PUBLISHED"
                ? ["pause", "close"]
                : row.status === "PAUSED"
                  ? ["publish", "close"]
                  : row.status === "CLOSED"
                    ? ["approve", "archive"]
                    : row.status === "APPROVED"
                      ? ["archive"]
                      : []
            ).map((action) => (
              <button
                disabled={busy}
                key={action}
                onClick={() => void command({ action, id: row.id })}
                className="border rounded-lg px-3 py-2"
              >
                {
                  (
                    {
                      publish: t(
                        "انتشار",
                        "Publish",
                        "Veröffentlichen",
                        "Yayımla",
                      ),
                      pause: t("توقف", "Pause", "Pausieren", "Duraklat"),
                      close: t(
                        "بستن و محاسبه نتایج",
                        "Close & rank",
                        "Schließen und auswerten",
                        "Kapat ve sırala",
                      ),
                      approve: t(
                        "تأیید برنده و پاداش",
                        "Approve winner & reward",
                        "Gewinner und Prämie bestätigen",
                        "Kazanan ve ödülü onayla",
                      ),
                      archive: t("آرشیو", "Archive", "Archivieren", "Arşivle"),
                    } as Record<string, string>
                  )[action]
                }
              </button>
            ))}
          </div>
          {row.results !== "[]" && (
            <details>
              <summary>
                {t(
                  "نتایج ثبت‌شده",
                  "Saved results",
                  "Gespeicherte Ergebnisse",
                  "Kayıtlı sonuçlar",
                )}
              </summary>
              <pre className="text-xs overflow-auto" dir="ltr">
                {row.results}
              </pre>
            </details>
          )}
        </article>
      ))}
      {rewards.map((r) => (
        <article key={r.id} className="rounded-xl border p-4">
          <strong>{r.title==="MONTHLY_PACKAGE_CHOICE"?t("یک ماه پکیج انتخابی","One month, chosen package","Ein Monat, Wunschpaket","Bir aylık seçilen paket"):r.title}</strong>
          <p className="text-xs opacity-70">
            {r.userId} · {r.status} · {r.packageChoice}
          </p>
          {r.status === "APPROVED" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const data = new FormData(e.currentTarget);
                void command({
                  action: "fulfill",
                  id: r.id,
                  note: data.get("note"),
                });
              }}
            >
              <input
                name="note"
                minLength={5}
                required
                placeholder={t(
                  "یادداشت تحویل",
                  "Delivery note",
                  "Liefernotiz",
                  "Teslimat notu",
                )}
                className="border rounded-lg bg-transparent p-2"
              />
              <button disabled={busy} className="border rounded-lg px-3 py-2">
                {t(
                  "ثبت تحویل",
                  "Record fulfillment",
                  "Lieferung erfassen",
                  "Teslimatı kaydet",
                )}
              </button>
            </form>
          )}
        </article>
      ))}
    </section>
  );
}
