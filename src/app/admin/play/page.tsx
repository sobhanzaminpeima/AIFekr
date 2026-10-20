"use client";
import { useCallback, useEffect, useState } from "react";
import { useTranslation, tri } from "@/lib/i18n";
import CompetitionManager from "@/components/play/CompetitionManager";
import QuestionManager from "@/components/play/QuestionManager";
type AdminData = {
  configuration: { status: string };
  games: {
    slug: string;
    status: string;
    version: number;
    configuration: string;
  }[];
  players: {
    userId: string;
    xp: number;
    points: number;
    suspended: boolean;
    user: { name: string | null };
  }[];
  sessions: { id: string; gameSlug: string; status: string; score: number }[];
  totals: { players: number; sessions: number; verified: number };
};
export default function AdminPlay() {
  const { lang } = useTranslation(),
    t = (fa: string, en: string, de: string, tr: string) =>
      tri(lang, fa, en, de, tr),
    [data, setData] = useState<AdminData | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const r = await fetch("/api/admin/play");
    if (!r.ok) throw Error("LOAD_FAILED");
    setData(await r.json());
  }, []);
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);
  async function command(body: unknown) {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw Error("SAVE_FAILED");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ERROR");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="p-4 sm:p-6 space-y-5">
      <h1 className="text-xl font-bold">AIFekr PLAY</h1>
      <p className="text-sm opacity-70">
        {t(
          "بازی رایگان؛ XP مستقل از کردیت هوش مصنوعی است. مسابقه پولی فعال نیست.",
          "Free games. XP is separate from AI credits. Paid-entry competitions are disabled.",
          "Kostenlose Spiele. XP ist von KI-Credits getrennt. Keine bezahlten Wettbewerbe.",
          "Ücretsiz oyunlar. XP, AI kredisinden ayrıdır. Ücretli yarışmalar kapalıdır.",
        )}
      </p>
      {error && <p role="alert">{error}</p>}
      {data && (
        <>
          <div className="grid grid-cols-3 gap-3">
            {Object.entries(data.totals).map(([key, value]) => (
              <div key={key} className="rounded-2xl border p-4">
                <small>{key}</small>
                <strong className="block text-2xl">{value}</strong>
              </div>
            ))}
          </div>
          <label className="block">
            {t("وضعیت ماژول", "Module status", "Modulstatus", "Modül durumu")}
            <select
              disabled={busy}
              value={data.configuration.status}
              onChange={(e) =>
                void command({ action: "lifecycle", status: e.target.value })
              }
              className="block border rounded-xl p-3 bg-transparent"
            >
              {[
                "INSTALLED",
                "ENABLED",
                "DISABLED",
                "MAINTENANCE",
                "ARCHIVED",
              ].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <div className="grid md:grid-cols-2 gap-3">
            {data.games.map((g) => (
              <article
                key={g.slug}
                className="border rounded-2xl p-4 flex items-center justify-between gap-4"
              >
                <div>
                  <h2>{g.slug}</h2>
                  <small>v{g.version}</small>
                </div>
                <select
                  disabled={busy}
                  value={g.status}
                  onChange={(e) =>
                    void command({
                      action: "game",
                      slug: g.slug,
                      status: e.target.value,
                    })
                  }
                  className="border rounded-lg p-2 bg-transparent"
                >
                  {["ENABLED", "DISABLED", "MAINTENANCE", "ARCHIVED"].map(
                    (v) => (
                      <option key={v}>{v}</option>
                    ),
                  )}
                </select>
                {g.slug !== "brain" && (
                  <form
                    className="flex flex-wrap gap-2 text-xs"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      void command({
                        action: "game",
                        slug: g.slug,
                        status: g.status,
                        rules: {
                          speedScale: Number(f.get("speed")),
                          pointScale: Number(f.get("points")),
                        },
                      });
                    }}
                  >
                    <label>
                      {t("سرعت", "Speed", "Tempo", "Hız")}
                      <input
                        name="speed"
                        type="number"
                        min="0.5"
                        max="2"
                        step="0.1"
                        defaultValue={
                          JSON.parse(g.configuration).speedScale ?? 1
                        }
                        className="block w-20 border rounded-lg p-2 bg-transparent"
                      />
                    </label>
                    <label>
                      {t(
                        "ضریب امتیاز",
                        "Point multiplier",
                        "Punktefaktor",
                        "Puan çarpanı",
                      )}
                      <input
                        name="points"
                        type="number"
                        min="1"
                        max="3"
                        defaultValue={
                          JSON.parse(g.configuration).pointScale ?? 1
                        }
                        className="block w-20 border rounded-lg p-2 bg-transparent"
                      />
                    </label>
                    <button disabled={busy} className="border rounded-lg p-2">
                      {t(
                        "ذخیره قوانین",
                        "Save rules",
                        "Regeln speichern",
                        "Kuralları kaydet",
                      )}
                    </button>
                  </form>
                )}
              </article>
            ))}
          </div>
          <h2 className="font-semibold">
            {t(
              "بازیکنان و تاریخچه",
              "Players & history",
              "Spieler und Verlauf",
              "Oyuncular ve geçmiş",
            )}
          </h2>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {["Player", "XP", "Points", "Status"].map((x) => (
                    <th className="p-3 text-start" key={x}>
                      {x}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.players.map((p) => (
                  <tr key={p.userId}>
                    <td className="p-3">{p.user.name || p.userId}</td>
                    <td>{p.xp}</td>
                    <td>{p.points}</td>
                    <td>
                      <button
                        disabled={busy}
                        className="rounded-lg border px-3 py-2"
                        onClick={() => {
                          const reason = window.prompt(
                            t(
                              "دلیل اقدام مدیریتی",
                              "Moderation reason",
                              "Grund der Moderation",
                              "Moderasyon nedeni",
                            ),
                          );
                          if (reason && reason.length >= 3)
                            void command({
                              action: "moderate",
                              userId: p.userId,
                              suspended: !p.suspended,
                              reason,
                            });
                        }}
                      >
                        {p.suspended
                          ? t(
                              "رفع تعلیق",
                              "Unsuspend",
                              "Entsperren",
                              "Askıyı kaldır",
                            )
                          : t("تعلیق", "Suspend", "Sperren", "Askıya al")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-2">
            {data.sessions.map((s) => (
              <div
                key={s.id}
                className="rounded-xl border p-3 flex justify-between"
              >
                <span>{s.gameSlug}</span>
                <span>{s.status}</span>
                <strong>{s.score}</strong>
              </div>
            ))}
          </div>
        </>
      )}
      <CompetitionManager />
      <QuestionManager />
    </div>
  );
}
