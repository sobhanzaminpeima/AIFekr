"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Trophy, Zap, Clock, Star, ChevronRight, RotateCcw, Share2 } from "lucide-react";

interface GameInfo {
  id: string; slug: string; name: string; nameEn: string;
  description: string; type: string; isFeatured: boolean;
  durationSec: number; _count: { sessions: number };
}

interface Question {
  id: string; text: string; textEn: string | null;
  options: { id: string; text: string }[]; points: number;
}

interface LeaderboardEntry {
  id: string; score: number; maxScore: number;
  user: { id: string; name: string | null; avatar: string | null };
  game: { name: string; slug: string };
  completedAt: string;
}

type Phase = "lobby" | "playing" | "result";

export default function PlayPage() {
  const [games, setGames] = useState<GameInfo[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [phase, setPhase] = useState<Phase>("lobby");
  const [selectedGame, setSelectedGame] = useState<GameInfo | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [result, setResult] = useState<{ score: number; maxScore: number; percentage: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const startTime = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch("/api/games").then(r => r.json()).then(d => setGames(d.games || [])).catch(console.error);
    fetch("/api/games/leaderboard").then(r => r.json()).then(d => setLeaderboard(d.leaderboard || [])).catch(console.error);
  }, []);

  const startGame = useCallback(async (game: GameInfo) => {
    setLoading(true); setError("");
    try {
      const r = await fetch("/api/games/sessions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId: game.id }),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(d.error || "خطا"); }
      const d = await r.json();
      setSessionId(d.sessionId);
      setQuestions(d.questions);
      setCurrentQ(0); setAnswers({});
      setTimeLeft(d.durationSec);
      setSelectedGame(game);
      setPhase("playing");
      startTime.current = Date.now();

      timerRef.current = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) { clearInterval(timerRef.current!); return 0; }
          return t - 1;
        });
      }, 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطای ناشناخته");
    }
    setLoading(false);
  }, []);

  const selectAnswer = (qId: string, optId: string) => {
    setAnswers(prev => ({ ...prev, [qId]: optId }));
    if (currentQ < questions.length - 1) {
      setTimeout(() => setCurrentQ(c => c + 1), 300);
    }
  };

  const submitGame = useCallback(async () => {
    if (!sessionId) return;
    clearInterval(timerRef.current!);
    setLoading(true);
    try {
      const r = await fetch(`/api/games/sessions/${sessionId}/submit`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, durationMs: Date.now() - startTime.current }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "خطا");
      setResult(d); setPhase("result");
      // refresh leaderboard
      fetch("/api/games/leaderboard").then(r2 => r2.json()).then(d2 => setLeaderboard(d2.leaderboard || []));
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطای ناشناخته");
    }
    setLoading(false);
  }, [sessionId, answers]);

  // Auto-submit when timer runs out
  useEffect(() => {
    if (phase === "playing" && timeLeft === 0) submitGame();
  }, [timeLeft, phase, submitGame]);

  const typeIcon = (type: string) => ({ quiz: "🧠", logic: "⚡", memory: "🎯", pattern: "🔷", business: "💼" }[type] || "🎮");

  return (
    <div style={{ minHeight: "100vh", background: "var(--background, #0b0d10)", color: "var(--foreground, #f0f0f0)", padding: "24px 16px", maxWidth: 800, margin: "0 auto", direction: "rtl" }}>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "#FF6B00", marginBottom: 8 }}>🎮 پلی‌گراند هوشمند</h1>
        <p style={{ color: "#888", fontSize: 14 }}>مهارت‌هایت را بیازمای و از دیگران پیشی بگیر</p>
      </div>

      {error && (
        <div style={{ background: "#3d1a1a", border: "1px solid #c53030", borderRadius: 8, padding: "12px 16px", marginBottom: 16, color: "#fc8181" }}>
          {error}
        </div>
      )}

      {phase === "lobby" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 16, marginBottom: 32 }}>
            {games.length === 0 && (
              <div style={{ color: "#666", textAlign: "center", gridColumn: "1/-1", padding: 40 }}>
                بازی‌ای موجود نیست. ادمین باید بازی‌ها را فعال کند.
              </div>
            )}
            {games.map(g => (
              <div key={g.id} onClick={() => startGame(g)} style={{ background: "#141618", border: "1px solid #252729", borderRadius: 12, padding: 20, cursor: "pointer", transition: "border-color 0.2s", position: "relative" }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = "#FF6B00")}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "#252729")}>
                {g.isFeatured && <span style={{ position: "absolute", top: 12, left: 12, background: "#FF6B00", color: "#fff", fontSize: 10, padding: "2px 8px", borderRadius: 20 }}>ویژه</span>}
                <div style={{ fontSize: 32, marginBottom: 8 }}>{typeIcon(g.type)}</div>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{g.name}</h3>
                <p style={{ color: "#666", fontSize: 13, marginBottom: 12 }}>{g.description}</p>
                <div style={{ display: "flex", gap: 12, fontSize: 12, color: "#888" }}>
                  <span><Clock size={12} style={{ display: "inline", marginLeft: 4 }} />{g.durationSec}s</span>
                  <span><Zap size={12} style={{ display: "inline", marginLeft: 4 }} />{g._count.sessions} بازی</span>
                </div>
                <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 4, color: "#FF6B00", fontSize: 14, fontWeight: 500 }}>
                  <span>شروع بازی</span><ChevronRight size={14} />
                </div>
              </div>
            ))}
          </div>

          {leaderboard.length > 0 && (
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                <Trophy size={18} color="#FF6B00" /> رتبه‌بندی برتر
              </h2>
              <div style={{ background: "#141618", border: "1px solid #252729", borderRadius: 12, overflow: "hidden" }}>
                {leaderboard.slice(0, 10).map((e, i) => (
                  <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: i < 9 ? "1px solid #1e2022" : "none" }}>
                    <span style={{ fontSize: 18, width: 28 }}>{["🥇", "🥈", "🥉"][i] || `${i + 1}`}</span>
                    <span style={{ flex: 1, fontSize: 14 }}>{e.user.name || "کاربر"}</span>
                    <span style={{ fontSize: 12, color: "#888" }}>{e.game.name}</span>
                    <span style={{ fontWeight: 600, color: "#FF6B00" }}>{e.score}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {phase === "playing" && questions.length > 0 && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <span style={{ fontSize: 14, color: "#888" }}>{selectedGame?.name}</span>
            <span style={{ fontSize: 16, fontWeight: 600, color: timeLeft <= 10 ? "#ef4444" : "#FF6B00" }}>
              <Clock size={14} style={{ display: "inline", marginLeft: 4 }} />{timeLeft}s
            </span>
          </div>

          <div style={{ marginBottom: 12, background: "#252729", borderRadius: 20, height: 4 }}>
            <div style={{ background: "#FF6B00", height: "100%", borderRadius: 20, width: `${((currentQ + 1) / questions.length) * 100}%`, transition: "width 0.3s" }} />
          </div>
          <p style={{ fontSize: 12, color: "#666", marginBottom: 20 }}>سوال {currentQ + 1} از {questions.length}</p>

          <div style={{ background: "#141618", border: "1px solid #252729", borderRadius: 12, padding: 24, marginBottom: 16 }}>
            <p style={{ fontSize: 18, fontWeight: 500, marginBottom: 0 }}>{questions[currentQ].text}</p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {questions[currentQ].options.map(opt => {
              const chosen = answers[questions[currentQ].id] === opt.id;
              return (
                <button key={opt.id} onClick={() => selectAnswer(questions[currentQ].id, opt.id)}
                  style={{ padding: "14px 16px", background: chosen ? "#FF6B00" : "#141618", border: `1px solid ${chosen ? "#FF6B00" : "#252729"}`, borderRadius: 10, color: chosen ? "#fff" : "#e0e0e0", cursor: "pointer", fontSize: 14, textAlign: "right", transition: "all 0.15s" }}>
                  {opt.text}
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
            {currentQ > 0 && (
              <button onClick={() => setCurrentQ(c => c - 1)} style={{ padding: "10px 16px", background: "transparent", border: "1px solid #252729", borderRadius: 8, color: "#888", cursor: "pointer" }}>
                قبلی
              </button>
            )}
            <div style={{ flex: 1 }} />
            {currentQ < questions.length - 1 ? (
              <button onClick={() => setCurrentQ(c => c + 1)} style={{ padding: "10px 20px", background: "#FF6B00", border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", fontWeight: 600 }}>
                بعدی <ChevronRight size={14} style={{ display: "inline" }} />
              </button>
            ) : (
              <button onClick={submitGame} disabled={loading} style={{ padding: "10px 20px", background: "#22c55e", border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", fontWeight: 600 }}>
                {loading ? "در حال ثبت..." : "ثبت پاسخ‌ها ✓"}
              </button>
            )}
          </div>
        </div>
      )}

      {phase === "result" && result && (
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>{result.percentage >= 80 ? "🏆" : result.percentage >= 50 ? "⭐" : "💪"}</div>
          <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
            {result.percentage >= 80 ? "عالی!" : result.percentage >= 50 ? "خوب بود!" : "تلاش بیشتری کن!"}
          </h2>
          <p style={{ color: "#888", marginBottom: 24 }}>امتیاز تو: <span style={{ color: "#FF6B00", fontWeight: 700, fontSize: 20 }}>{result.score}</span> از {result.maxScore}</p>

          <div style={{ background: "#141618", border: "1px solid #252729", borderRadius: 12, padding: 20, marginBottom: 24, display: "inline-block" }}>
            <div style={{ fontSize: 48, fontWeight: 700, color: "#FF6B00" }}>{result.percentage}%</div>
            <div style={{ color: "#888", fontSize: 14 }}>درصد صحیح</div>
          </div>

          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={() => { setPhase("lobby"); setResult(null); setSelectedGame(null); }}
              style={{ padding: "12px 24px", background: "#FF6B00", border: "none", borderRadius: 10, color: "#fff", cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
              <RotateCcw size={16} /> بازی مجدد
            </button>
            <button onClick={() => navigator.share?.({ title: "نتیجه بازی AIFekr", text: `امتیاز من: ${result.score} — ${result.percentage}%` })}
              style={{ padding: "12px 24px", background: "#141618", border: "1px solid #252729", borderRadius: 10, color: "#e0e0e0", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
              <Share2 size={16} /> اشتراک‌گذاری
            </button>
          </div>

          {leaderboard.length > 0 && (
            <div style={{ marginTop: 32, textAlign: "right" }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}><Star size={16} style={{ display: "inline", color: "#FF6B00" }} /> رتبه‌بندی جدید</h3>
              {leaderboard.slice(0, 5).map((e, i) => (
                <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid #1e2022" }}>
                  <span>{["🥇", "🥈", "🥉"][i] || `${i + 1}`}</span>
                  <span style={{ flex: 1, fontSize: 14 }}>{e.user.name || "کاربر"}</span>
                  <span style={{ fontWeight: 600, color: "#FF6B00" }}>{e.score}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
