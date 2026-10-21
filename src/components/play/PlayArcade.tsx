"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Gamepad2,
  Pause,
  Play,
  Trophy,
  Volume2,
  VolumeX,
  Layers,
  Car,
  Grid2X2,
  Brain,
  Feather,
  Move,
} from "lucide-react";
import { useTranslation, tri } from "@/lib/i18n";
import {
  gameSlugs,
  initializeGame,
  stepGame,
  type EngineState,
  type GameSlug,
  type PlayInput,
  type ReplayEvent,
} from "@/lib/play/engine";
import "./play.css";
import Competitions from "./Competitions";
import { achievementName, playError } from "@/lib/play/copy";
import ShareResult from "./ShareResult";
type Overview = {
  profile: {
    xp: number;
    level: number;
    sessions: number;
    points: number;
    publicName: boolean;
  } | null;
  games: { slug: string; status: string }[];
  history: { id: string; gameSlug: string; score: number; xp: number }[];
  rankings: { rank: number; name: string; mine: boolean; points: number }[];
  achievements: { code: string }[];
  personalBests: Record<string, number>;
  user: { name: string | null } | null;
};
async function api(url: string, body?: unknown) {
  const r = await fetch(
    url,
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : { cache: "no-store" },
  );
  const d = await r.json();
  if (!r.ok) throw Error(d.error || "REQUEST_FAILED");
  return d;
}
export default function PlayArcade() {
  const { lang } = useTranslation(),
    t = (fa: string, en: string, de: string, tr: string) =>
      tri(lang, fa, en, de, tr),
    [overview, setOverview] = useState<Overview | null>(null),
    [game, setGame] = useState<GameSlug>("tower"),
    [state, setState] = useState<EngineState | null>(null),
    [running, setRunning] = useState(false),
    [paused, setPaused] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState<{ score: number; xp: number } | null>(null),
    [muted, setMuted] = useState(true),
    [period, setPeriod] = useState("all"),
    [ranks, setRanks] = useState<Overview["rankings"] | null>(null),
    [brain, setBrain] = useState<{
      question?: { index: number; prompt: string; options: string[] };
      feedback?: { explanation: string };
      done?: boolean;
      score?: number;
      xp?: number;
    } | null>(null);
  const current = useRef<EngineState | null>(null),
    input = useRef<PlayInput>("none"),
    events = useRef<ReplayEvent[]>([]),
    session = useRef(""),
    touch = useRef<{ x: number; y: number } | null>(null),
    sound = useRef<AudioContext | null>(null);
  const names: Record<GameSlug, string> = {
    tower: t("برج آی‌فکر", "AIFekr Tower", "AIFekr Tower", "AIFekr Kule"),
    snake: t("مار پرسرعت", "Snake Rush", "Snake Rush", "Hızlı Yılan"),
    "2048": t("نبرد ۲۰۴۸", "2048 Battle", "2048 Battle", "2048 Savaşı"),
    "speed-run": t("مسابقه سرعت", "Speed Run", "Speed Run", "Hız Yarışı"),
    "fiko-fly": t("پرواز فیکو", "FIKO Fly", "FIKO Fly", "FIKO Uçuş"),
    brain: t("چالش ذهن", "Brain Challenge", "Denk-Challenge", "Zihin Yarışı"),
  };
  const gameIcons = {
    tower: Layers,
    snake: Move,
    "2048": Grid2X2,
    "speed-run": Car,
    "fiko-fly": Feather,
    brain: Brain,
  };
  const load = useCallback(
    () =>
      api("/api/play")
        .then(setOverview)
        .catch((e) => setError(e.message)),
    [],
  );
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    let active = true;
    api(`/api/play/leaderboard?period=${period}`)
      .then((d) => {
        if (active) setRanks(d.rankings);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [period, overview]);
  async function start(selectedGame: GameSlug = game, tournamentId?: string) {
    setBusy(true);
    setError("");
    try {
      if (session.current)
        await api("/api/play/sessions", {
          action: "abandon",
          id: session.current,
        });
      setGame(selectedGame);
      input.current = "none";
      const d = await api("/api/play/sessions", {
        action: "start",
        game: selectedGame,
        language: lang,
        ...(tournamentId ? { tournamentId } : {}),
      });
      session.current = d.session.id;
      events.current = [];
      const initial = initializeGame(
        selectedGame,
        d.session.seed,
        d.session.configuration,
      );
      current.current = initial;
      setState(initial);
      setResult(null);
      setPaused(false);
      if (selectedGame === "brain") {
        setBrain(await api("/api/play/brain", { id: session.current }));
        setRunning(false);
      } else {
        setBrain(null);
        setRunning(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "ERROR");
    } finally {
      setBusy(false);
    }
  }
  const finish = useCallback(async () => {
    setRunning(false);
    const s = current.current;
    if (!s) return;
    setBusy(true);
    try {
      const d = await api("/api/play/sessions", {
        action: "finish",
        id: session.current,
        frames: s.frame,
        events: events.current,
      });
      setResult(d.result);
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "RESULT_FAILED");
    } finally {
      setBusy(false);
    }
  }, [load]);
  useEffect(() => {
    if (!running || paused) return;
    const timer = setInterval(() => {
      const prior = current.current;
      if (!prior) return;
      const action = input.current;
      input.current = "none";
      if (action !== "none")
        events.current.push({ frame: prior.frame + 1, input: action });
      const next = stepGame(prior, action);
      current.current = next;
      setState(next);
      if (next.score > prior.score && !muted) {
        try {
          sound.current ??= new AudioContext();
          const oscillator = sound.current.createOscillator(),
            gain = sound.current.createGain();
          gain.gain.value = 0.025;
          oscillator.frequency.value = 440;
          oscillator.connect(gain);
          gain.connect(sound.current.destination);
          oscillator.start();
          oscillator.stop(sound.current.currentTime + 0.06);
        } catch {
          /* Audio is optional. */
        }
      }
      if (next.over) void finish();
    }, 50);
    return () => clearInterval(timer);
  }, [running, paused, finish, muted]);
  useEffect(() => {
    const hide = () => {
      if (document.hidden) setPaused(true);
    };
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  }, []);
  useEffect(() => {
    const keys: Record<string, PlayInput> = {
      ArrowLeft: "left",
      a: "left",
      ArrowRight: "right",
      d: "right",
      ArrowUp: "up",
      w: "up",
      ArrowDown: "down",
      s: "down",
      " ": "tap",
    };
    const onKey = (e: KeyboardEvent) => {
      if (
        running &&
        !paused &&
        keys[e.key] &&
        !(
          e.target instanceof HTMLElement &&
          (e.target.closest("input,textarea,select") ||
            e.target.isContentEditable)
        )
      ) {
        e.preventDefault();
        input.current = keys[e.key];
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [running, paused]);
  async function answer(index: number) {
    if (!brain?.question) return;
    setBusy(true);
    try {
      const d = await api("/api/play/brain", {
        id: session.current,
        index: brain.question.index,
        answer: index,
      });
      setBrain(d);
      if (d.done) {
        setResult({ score: d.score, xp: d.xp });
        void load();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "ANSWER_FAILED");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="aifekr-play" dir={lang === "fa" ? "rtl" : "ltr"}>
      <header className="play-header">
        <div>
          <span className="play-kicker">AIFEKR PLAY</span>
          <h1>
            {t(
              "بازی کن، بهتر شو",
              "Play. Improve. Repeat.",
              "Spielen. Besser werden.",
              "Oyna. Geliş. Tekrarla.",
            )}
          </h1>
          <p>
            {t(
              "بازی رایگان · امتیاز تأییدشده · بدون مصرف کردیت هوش مصنوعی",
              "Free games · verified scores · no AI credits",
              "Kostenlose Spiele · geprüfte Punkte · keine KI-Credits",
              "Ücretsiz oyunlar · doğrulanmış puanlar · AI kredisi harcanmaz",
            )}
          </p>
        </div>
        <Gamepad2 size={48} />
      </header>
      {error && (
        <p role="alert" className="play-error">
          {playError(lang, error)}
        </p>
      )}
      <section className="play-stats">
        {[
          [t("سطح", "Level", "Level", "Seviye"), overview?.profile?.level || 1],
          ["XP", overview?.profile?.xp || 0],
          [
            t("امتیاز بازی", "Game points", "Spielpunkte", "Oyun puanı"),
            overview?.profile?.points || 0,
          ],
          [
            t(
              "بازی‌های ثبت‌شده",
              "Verified sessions",
              "Geprüfte Spiele",
              "Doğrulanmış oyunlar",
            ),
            overview?.profile?.sessions || 0,
          ],
        ].map(([label, value]) => (
          <article key={label}>
            <small>{label}</small>
            <strong>{Number(value).toLocaleString(lang)}</strong>
          </article>
        ))}
      </section>
      <div className="play-layout">
        <section>
          <nav className="play-games" aria-label="Games">
            {gameSlugs.map((slug) => {
              const Icon = gameIcons[slug];
              return (
                <button
                  key={slug}
                  disabled={running || busy}
                  aria-pressed={game === slug}
                  onClick={() => {
                    setGame(slug);
                    setState(null);
                    setBrain(null);
                    setResult(null);
                  }}
                >
                  <Icon size={24} />
                  <strong>{names[slug]}</strong>
                  <small>
                    {t("رکورد", "Best", "Rekord", "Rekor")}:{" "}
                    {(overview?.personalBests[slug] ?? 0).toLocaleString(lang)}{" "}
                    ·{" "}
                    {slug === "brain"
                      ? t("۲ دقیقه", "2 minutes", "2 Minuten", "2 dakika")
                      : t(
                          "۱–۱۰ دقیقه",
                          "1–10 minutes",
                          "1–10 Minuten",
                          "1–10 dakika",
                        )}
                  </small>
                </button>
              );
            })}
          </nav>
          <section className="play-arena">
            <header>
              <h2>{names[game]}</h2>
              <span>{state?.score || 0}</span>
            </header>
            <small>
              {t(
                "رکورد من",
                "Personal best",
                "Persönlicher Rekord",
                "Kişisel rekor",
              )}
              : {(overview?.personalBests[game] ?? 0).toLocaleString(lang)}
            </small>
            <p className="play-instructions">
              {game === "tower"
                ? t(
                    "برای چیدن بلوک، ضربه بزن یا Space را فشار بده.",
                    "Tap or press Space to stack the block.",
                    "Tippen oder Leertaste zum Stapeln.",
                    "Bloğu yerleştirmek için dokun veya Space tuşuna bas.",
                  )
                : game === "brain"
                  ? t(
                      "پاسخ‌ها سمت سرور بررسی می‌شوند؛ برای هر سؤال ۳۰ ثانیه وقت داری.",
                      "Answers are checked on the server. You have 30 seconds per question.",
                      "Antworten werden serverseitig geprüft. 30 Sekunden pro Frage.",
                      "Yanıtlar sunucuda kontrol edilir. Soru başına 30 saniye.",
                    )
                  : t(
                      "از کلیدهای جهت، WASD یا دکمه‌ها استفاده کن؛ روی موبایل بکش.",
                      "Use arrows, WASD or buttons. Swipe on mobile.",
                      "Pfeiltasten, WASD oder Tasten nutzen. Mobil wischen.",
                      "Ok tuşlarını, WASD veya düğmeleri kullan. Mobilde kaydır.",
                    )}
            </p>
            {brain?.question ? (
              <div className="play-question">
                <h3>{brain.question.prompt}</h3>
                {brain.question.options.map((option, i) => (
                  <button
                    disabled={busy}
                    key={i}
                    onClick={() => void answer(i)}
                  >
                    {option}
                  </button>
                ))}
                {brain.feedback && <p>{brain.feedback.explanation}</p>}
              </div>
            ) : (
              <div
                className="play-board"
                role="application"
                aria-label={names[game]}
                tabIndex={0}
                onClick={() => {
                  input.current = "tap";
                }}
                onTouchStart={(e) => {
                  touch.current = {
                    x: e.touches[0].clientX,
                    y: e.touches[0].clientY,
                  };
                }}
                onTouchEnd={(e) => {
                  if (!touch.current) return;
                  const dx = e.changedTouches[0].clientX - touch.current.x,
                    dy = e.changedTouches[0].clientY - touch.current.y;
                  if (Math.max(Math.abs(dx), Math.abs(dy)) > 20)
                    input.current =
                      Math.abs(dx) > Math.abs(dy)
                        ? dx > 0
                          ? "right"
                          : "left"
                        : dy > 0
                          ? "down"
                          : "up";
                  else input.current = "tap";
                }}
              >
                {!state && (
                  <div className="play-start-art">
                    <Gamepad2 size={72} />
                    <p>{t("آماده‌ای؟", "Ready?", "Bereit?", "Hazır mısın?")}</p>
                  </div>
                )}
                {state && game === "2048" && (
                  <div className="play-tiles">
                    {state.board.map((n, i) => (
                      <div
                        key={i}
                        style={{
                          background: n
                            ? `hsl(${25 + Math.log2(n) * 3} 85% ${Math.max(28, 65 - Math.log2(n) * 3)}%)`
                            : undefined,
                        }}
                      >
                        {n || ""}
                      </div>
                    ))}
                  </div>
                )}
                {state && game === "snake" && (
                  <div className="play-snake-grid">
                    {Array.from({ length: 400 }, (_, i) => (
                      <i
                        key={i}
                        className={
                          state.snake.includes(i)
                            ? "snake"
                            : state.food === i
                              ? "food"
                              : ""
                        }
                      />
                    ))}
                  </div>
                )}
                {state && game === "tower" && (
                  <>
                    <div className="play-tower-stack">
                      {state.layers.slice(-10).map((layer, i) => (
                        <i
                          key={i}
                          style={{
                            left: `${layer.x}%`,
                            width: `${layer.width}%`,
                            bottom: `${i * 7}%`,
                          }}
                        />
                      ))}
                    </div>
                    <i
                      className="play-moving-block"
                      style={{
                        left: `${state.x}%`,
                        width: `${state.width}%`,
                        bottom: `${Math.min(state.layers.length, 10) * 7}%`,
                      }}
                    />
                  </>
                )}
                {state && game === "speed-run" && (
                  <>
                    <div className="play-lanes" />
                    {state.obstacles.map((o, i) => (
                      <i
                        key={i}
                        className="play-obstacle"
                        style={{ left: `${o.x * 33.3 + 8}%`, top: `${o.y}%` }}
                      />
                    ))}
                    <i
                      className="play-car"
                      style={{ left: `${state.lane * 33.3 + 8}%` }}
                    />
                  </>
                )}
                {state && game === "fiko-fly" && (
                  <>
                    <div
                      role="img"
                      aria-label="FIKO"
                      className="play-fiko"
                      style={{
                        top: `${state.y}%`,
                        backgroundImage: "url(/fitness/fiko.png)",
                        backgroundSize: "cover",
                        backgroundPosition: "center 20%",
                      }}
                    />
                    {state.obstacles.map((o, i) => (
                      <div key={i}>
                        <i
                          className="play-pipe"
                          style={{
                            left: `${o.x}%`,
                            height: `${o.y - 18}%`,
                            top: 0,
                          }}
                        />
                        <i
                          className="play-pipe"
                          style={{
                            left: `${o.x}%`,
                            height: `${100 - o.y - 18}%`,
                            bottom: 0,
                          }}
                        />
                      </div>
                    ))}
                  </>
                )}
                {paused && running && (
                  <div className="play-overlay">
                    {t("توقف", "Paused", "Pausiert", "Duraklatıldı")}
                  </div>
                )}
              </div>
            )}
            <div className="play-controls">
              {!running && state && !result && error && game !== "brain" && (
                <button disabled={busy} onClick={() => void finish()}>
                  {t(
                    "تلاش مجدد برای ثبت",
                    "Retry saving",
                    "Erneut speichern",
                    "Kaydetmeyi tekrar dene",
                  )}
                </button>
              )}
              {!running ? (
                <button
                  disabled={
                    busy ||
                    !overview?.games.some(
                      (g) => g.slug === game && g.status === "ENABLED",
                    )
                  }
                  className="play-primary"
                  onClick={() => void start()}
                >
                  <Play size={18} />
                  {t("شروع بازی", "Start game", "Spiel starten", "Oyuna başla")}
                </button>
              ) : (
                <>
                  <button onClick={() => setPaused((p) => !p)}>
                    {paused ? <Play size={18} /> : <Pause size={18} />}
                  </button>
                  <button disabled={busy} onClick={() => void finish()}>
                    {t(
                      "ثبت نتیجه",
                      "Save result",
                      "Ergebnis speichern",
                      "Sonucu kaydet",
                    )}
                  </button>
                </>
              )}
              <button
                onClick={() => setMuted((v) => !v)}
                aria-label={t("صدا", "Sound", "Ton", "Ses")}
              >
                {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
            </div>
            {running && (
              <div className="play-dpad" dir="ltr">
                {(["left", "up", "down", "right"] as PlayInput[]).map(
                  (d, i) => (
                    <button
                      key={d}
                      onClick={() => {
                        input.current = d;
                      }}
                      aria-label={d}
                    >
                      {["←", "↑", "↓", "→"][i]}
                    </button>
                  ),
                )}
              </div>
            )}
            {result && (
              <div role="status" className="play-result">
                <Trophy />
                {t(
                  "نتیجه تأیید شد",
                  "Result verified",
                  "Ergebnis geprüft",
                  "Sonuç doğrulandı",
                )}{" "}
                · {result.score} · +{result.xp} XP
                <ShareResult
                  game={names[game]}
                  score={result.score}
                  name={
                    overview?.profile?.publicName
                      ? (overview.user?.name ?? undefined)
                      : undefined
                  }
                />
              </div>
            )}
          </section>
        </section>
        <aside>
          <section className="play-panel">
            <h2>
              {overview?.user?.name ||
                t(
                  "پروفایل بازی من",
                  "My player profile",
                  "Mein Spielprofil",
                  "Oyuncu profilim",
                )}
            </h2>
            <label>
              <input
                type="checkbox"
                checked={overview?.profile?.publicName ?? false}
                onChange={(e) => {
                  void api("/api/play/profile", {
                    publicName: e.target.checked,
                  })
                    .then(load)
                    .catch((e) => setError(e.message));
                }}
              />{" "}
              {t(
                "نمایش نام من در رتبه‌بندی",
                "Show my name on leaderboards",
                "Meinen Namen in Ranglisten zeigen",
                "Adımı liderlik tablosunda göster",
              )}
            </label>
            <a href="/referral">
              {t(
                "دعوت دوستان",
                "Invite friends",
                "Freunde einladen",
                "Arkadaşlarını davet et",
              )}
            </a>
          </section>
          <section className="play-panel">
            <h2>
              <Trophy size={18} />
              {t("رتبه‌بندی", "Leaderboard", "Rangliste", "Liderlik tablosu")}
            </h2>
            <select
              aria-label={t(
                "دوره رتبه‌بندی",
                "Ranking period",
                "Ranglistenzeitraum",
                "Sıralama dönemi",
              )}
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            >
              {[
                ["all", t("همیشه", "All time", "Gesamt", "Tüm zamanlar")],
                ["daily", t("امروز", "Today", "Heute", "Bugün")],
                [
                  "weekly",
                  t("این هفته", "This week", "Diese Woche", "Bu hafta"),
                ],
                [
                  "monthly",
                  t("این ماه", "This month", "Diesen Monat", "Bu ay"),
                ],
              ].map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {(ranks ?? overview?.rankings)?.map((p) => (
              <p key={p.rank} className={p.mine ? "play-mine" : ""}>
                <span>
                  {p.rank}. {p.name}
                </span>
                <strong>{p.points}</strong>
              </p>
            ))}
          </section>
          <section className="play-panel">
            <h2>{t("تاریخچه من", "My history", "Mein Verlauf", "Geçmişim")}</h2>
            {overview?.history.map((s) => (
              <p key={s.id}>
                <span>{names[s.gameSlug as GameSlug]}</span>
                <strong>{s.score}</strong>
              </p>
            ))}
          </section>
          <section className="play-panel">
            <h2>{t("دستاوردها", "Achievements", "Erfolge", "Başarılar")}</h2>
            {overview?.achievements.map((a) => (
              <span className="play-achievement" key={a.code}>
                {achievementName(lang, a.code)}
              </span>
            ))}
          </section>
        </aside>
      </div>
      <Competitions
        disabled={running || busy}
        onPlay={(g, id) => {
          void start(g, id);
        }}
      />
    </main>
  );
}
