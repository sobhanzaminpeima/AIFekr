"use client";
import { useCallback, useEffect, useState } from "react";
import { useTranslation, tri } from "@/lib/i18n";
import CompetitionManager from "@/components/play/CompetitionManager";
import QuestionManager from "@/components/play/QuestionManager";
import "@/components/admin/admin-workspace.css";
import { Gamepad2, ArrowUpRight } from "lucide-react";
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
    [busy, setBusy] = useState(false),
    [tab, setTab] = useState("overview");
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
    <div className="admin-workspace-page space-y-5">
      <header className="admin-page-header">
        <div>
          <span className="admin-page-kicker">AIFEKR · PLAY</span>
          <h1>
            {t(
              "مدیریت بازی‌ها",
              "Game management",
              "Spieleverwaltung",
              "Oyun yönetimi",
            )}
          </h1>
          <p className="text-sm opacity-70">
            {t(
              "بازی رایگان؛ XP مستقل از کردیت هوش مصنوعی است. مسابقه پولی فعال نیست.",
              "Free games. XP is separate from AI credits. Paid-entry competitions are disabled.",
              "Kostenlose Spiele. XP ist von KI-Credits getrennt. Keine bezahlten Wettbewerbe.",
              "Ücretsiz oyunlar. XP, AI kredisinden ayrıdır. Ücretli yarışmalar kapalıdır.",
            )}
          </p>
        </div>
        <a href="/play" className="flex items-center gap-2 text-orange-500">
          <Gamepad2 size={18} />
          {t("مشاهده بازی‌ها", "Open arcade", "Spiele öffnen", "Oyunları aç")}
          <ArrowUpRight size={16} />
        </a>
      </header>
      <nav
        className="admin-section-tabs"
        aria-label={t(
          "بخش‌های مدیریت بازی",
          "Game management sections",
          "Spielverwaltung",
          "Oyun yönetimi bölümleri",
        )}
      >
        {[
          ["overview", t("نمای کلی", "Overview", "Übersicht", "Genel bakış")],
          [
            "games",
            t("قوانین بازی‌ها", "Game rules", "Spielregeln", "Oyun kuralları"),
          ],
          [
            "players",
            t(
              "بازیکنان و تاریخچه",
              "Players & history",
              "Spieler und Verlauf",
              "Oyuncular ve geçmiş",
            ),
          ],
          [
            "competitions",
            t(
              "مسابقه‌ها و پاداش‌ها",
              "Competitions & rewards",
              "Wettbewerbe und Prämien",
              "Yarışmalar ve ödüller",
            ),
          ],
          [
            "questions",
            t("بانک سؤال", "Question bank", "Fragenbank", "Soru bankası"),
          ],
        ].map(([id, label]) => (
          <button
            key={id}
          aria-pressed={tab === id}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>
      {error && <p role="alert">{error}</p>}
      {data && (
        <>
          <div className="admin-metric-grid" hidden={tab !== "overview"}>
            {Object.entries(data.totals).map(([key, value]) => (
              <div key={key} className="rounded-2xl border p-4">
                <small>
                  {
                    {
                      players: t("بازیکنان", "Players", "Spieler", "Oyuncular"),
                      sessions: t(
                        "جلسه‌های بازی",
                        "Game sessions",
                        "Spielsitzungen",
                        "Oyun oturumları",
                      ),
                      verified: t(
                        "نتایج تأییدشده",
                        "Verified results",
                        "Geprüfte Ergebnisse",
                        "Doğrulanmış sonuçlar",
                      ),
                    }[key]
                  }
                </small>
                <strong className="block text-2xl">{value}</strong>
              </div>
            ))}
          </div>
          <label className="block" hidden={tab !== "overview"}>
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
          {tab === "overview" && (
            <section className="admin-overview-card">
              <div>
                <h2>
                  {t(
                    "کنترل بازی‌ها در یک نگاه",
                    "Your arcade at a glance",
                    "Ihre Spiele im Überblick",
                    "Oyun alanınız bir bakışta",
                  )}
                </h2>
                <p>
                  {t(
                    "قوانین هر بازی، سؤال‌ها و جوایز را در تب اختصاصی مدیریت کنید. امتیازها از کردیت مالی جدا هستند.",
                    "Manage game rules, questions and rewards in dedicated tabs. Game points stay separate from paid credits.",
                    "Spielregeln, Fragen und Prämien in eigenen Tabs verwalten. Spielpunkte bleiben von Credits getrennt.",
                    "Kuralları, soruları ve ödülleri ayrı sekmelerde yönetin. Oyun puanları ücretli kredilerden ayrıdır.",
                  )}
                </p>
              </div>
              <button className="admin-action" onClick={() => setTab("games")}>
                {t(
                  "مدیریت قوانین",
                  "Manage rules",
                  "Regeln verwalten",
                  "Kuralları yönet",
                )}
              </button>
            </section>
          )}
          <div className="admin-game-grid" hidden={tab !== "games"}>
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
          {tab === "players" && (
            <>
              <h2 className="font-semibold">
                {t(
                  "بازیکنان و تاریخچه",
                  "Players & history",
                  "Spieler und Verlauf",
                  "Oyuncular ve geçmiş",
                )}
              </h2>
              <div className="admin-table-scroll">
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
        </>
      )}
      {tab === "competitions" && <CompetitionManager />}
      {tab === "questions" && <QuestionManager />}
    </div>
  );
}
