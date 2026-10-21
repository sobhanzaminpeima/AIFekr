"use client";

import { useState, useEffect } from "react";
import { Gamepad2, Trophy, Zap, RefreshCw, AlertCircle } from "lucide-react";

interface LeaderEntry {
  id: string; score: number; maxScore: number; completedAt: string;
  user: { id: string; name: string | null };
  game: { name: string; slug: string };
}

export default function AdminGamesPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>([]);
  const [seeding, setSeeding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/games/leaderboard");
      const d = await r.json();
      setLeaderboard(d.leaderboard || []);
    } catch { setError("خطا در بارگذاری"); }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function seedGames() {
    setSeeding(true); setMsg(""); setError("");
    try {
      const r = await fetch("/api/games/seed", { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setMsg(`✓ ${d.seeded} بازی نمونه ثبت شد`);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا");
    }
    setSeeding(false);
  }

  return (
    <div style={{ padding: 24, direction: "rtl" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <Gamepad2 size={24} color="#FF6B00" />
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>مدیریت بازی‌ها</h1>
        <div style={{ marginRight: "auto", display: "flex", gap: 8 }}>
          <button onClick={load} style={{ padding: "8px 14px", background: "#1e2022", border: "1px solid #252729", borderRadius: 8, color: "#e0e0e0", cursor: "pointer", display: "flex", gap: 6, alignItems: "center" }}>
            <RefreshCw size={14} /> بارگذاری
          </button>
          <button onClick={seedGames} disabled={seeding} style={{ padding: "8px 14px", background: "#FF6B00", border: "none", borderRadius: 8, color: "#fff", cursor: "pointer", display: "flex", gap: 6, alignItems: "center" }}>
            <Zap size={14} /> {seeding ? "در حال ثبت..." : "ثبت بازی‌های نمونه"}
          </button>
        </div>
      </div>

      {(msg || error) && (
        <div style={{ background: error ? "#3d1a1a" : "#1a3d1a", border: `1px solid ${error ? "#c53030" : "#16a34a"}`, borderRadius: 8, padding: "10px 14px", marginBottom: 16, color: error ? "#fc8181" : "#86efac", display: "flex", gap: 8 }}>
          {error && <AlertCircle size={16} />} {msg || error}
        </div>
      )}

      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, display: "flex", gap: 8, alignItems: "center" }}>
        <Trophy size={16} color="#FF6B00" /> جدول رتبه‌بندی
      </h2>

      <div style={{ background: "#141618", border: "1px solid #252729", borderRadius: 12, overflow: "hidden" }}>
        {loading ? (
          <div style={{ color: "#666", textAlign: "center", padding: 40 }}>در حال بارگذاری...</div>
        ) : leaderboard.length === 0 ? (
          <div style={{ color: "#666", textAlign: "center", padding: 40 }}>هنوز بازی‌ای انجام نشده</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #252729" }}>
                {["رتبه", "کاربر", "بازی", "امتیاز", "تاریخ"].map(h => (
                  <th key={h} style={{ padding: "10px 16px", color: "#888", fontSize: 12, textAlign: "right", fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((e, i) => (
                <tr key={e.id} style={{ borderBottom: "1px solid #1e2022" }}>
                  <td style={{ padding: "10px 16px", fontSize: 16 }}>{["🥇", "🥈", "🥉"][i] || i + 1}</td>
                  <td style={{ padding: "10px 16px", fontSize: 14 }}>{e.user.name || "کاربر"}</td>
                  <td style={{ padding: "10px 16px", fontSize: 13, color: "#888" }}>{e.game.name}</td>
                  <td style={{ padding: "10px 16px", fontWeight: 600, color: "#FF6B00" }}>{e.score} / {e.maxScore}</td>
                  <td style={{ padding: "10px 16px", fontSize: 12, color: "#666" }}>{new Date(e.completedAt).toLocaleDateString("fa-IR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
