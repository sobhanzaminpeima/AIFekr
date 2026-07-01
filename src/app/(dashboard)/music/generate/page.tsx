"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useRef } from "react";
import { Music, Wand2, Loader2, CheckCircle, AlertCircle, Download, Play, Pause, Volume2 } from "lucide-react";
import toast from "react-hot-toast";

const GENRES = ["پاپ", "کلاسیک", "الکترونیک", "سنتی ایرانی", "آرامش‌بخش", "راک", "جاز", "هیپ‌هاپ"];
const DURATIONS = [
  { label: "۳۰ ثانیه", value: 30, credits: 10 },
  { label: "۱ دقیقه", value: 60, credits: 18 },
  { label: "۲ دقیقه", value: 120, credits: 30 },
];

type GenStatus = "idle" | "generating" | "polling" | "succeeded" | "failed";

export default function MusicGeneratePage() {
  const [prompt, setPrompt] = useState("");
  const [genre, setGenre] = useState("پاپ");
  const [duration, setDuration] = useState(30);
  const [status, setStatus] = useState<GenStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [predictionId, setPredictionId] = useState<string | null>(null);
  const [musicId, setMusicId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (status === "generating" || status === "polling") {
      const iv = setInterval(() => setProgress(p => p >= 85 ? p : p + Math.random() * 2), 2000);
      return () => clearInterval(iv);
    }
    if (status === "succeeded") setProgress(100);
  }, [status]);

  useEffect(() => {
    if (!predictionId || status !== "polling") return;
    const poll = async () => {
      try {
        const res = await fetch(`/api/music/status?predictionId=${predictionId}&musicId=${musicId}`);
        const data = await res.json();
        if (data.status === "succeeded") {
          setAudioUrl(data.output);
          setStatus("succeeded");
          toast.success("موزیک آماده شد! 🎵");
          clearInterval(pollRef.current);
        } else if (data.status === "failed") {
          setStatus("failed");
          clearInterval(pollRef.current);
        }
      } catch { /* keep polling */ }
    };
    poll();
    pollRef.current = setInterval(poll, 6000);
    return () => clearInterval(pollRef.current);
  }, [predictionId, musicId, status]);

  async function generate() {
    if (!prompt.trim()) return toast.error("توضیح موزیک را وارد کنید");
    setStatus("generating"); setProgress(5); setAudioUrl(null); setPlaying(false);
    const res = await fetch("/api/music/generate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, genre, duration }),
    });
    const data = await res.json();
    if (!res.ok) { setStatus("failed"); setProgress(0); return toast.error(data.error || "خطا در تولید موزیک"); }
    setPredictionId(data.predictionId);
    setMusicId(data.musicId);
    setStatus("polling");
  }

  function togglePlay() {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play(); setPlaying(true); }
  }

  async function downloadAudio() {
    if (!audioUrl) return;
    try {
      const res = await fetch(audioUrl);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = `music-${Date.now()}.mp3`; a.click();
    } catch { window.open(audioUrl, "_blank"); }
  }

  function formatTime(s: number) {
    const m = Math.floor(s / 60);
    return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  }

  const isLoading = status === "generating" || status === "polling";

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>ساخت موزیک با AI</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>موزیک دلخواه خود را با هوش مصنوعی بسازید</p>
      </div>

      <div className="p-5 rounded-2xl space-y-4" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-primary)" }}>توضیح موزیک</label>
          <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={3} disabled={isLoading}
            placeholder="مثال: موزیک آرام‌بخش با پیانو برای تمرکز..."
            className="w-full px-3 py-2.5 rounded-xl text-sm resize-none outline-none disabled:opacity-60"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-primary)" }}>ژانر</label>
          <div className="flex gap-2 flex-wrap">
            {GENRES.map(g => (
              <button key={g} onClick={() => setGenre(g)} disabled={isLoading}
                className="px-3 py-1.5 rounded-xl text-xs font-medium disabled:opacity-60"
                style={{ background: genre === g ? "var(--primary)" : "var(--surface-2)", color: genre === g ? "white" : "var(--text-secondary)" }}>
                {g}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-primary)" }}>مدت</label>
          <div className="flex gap-2">
            {DURATIONS.map(d => (
              <button key={d.value} onClick={() => setDuration(d.value)} disabled={isLoading}
                className="flex-1 py-2 rounded-xl text-xs font-medium disabled:opacity-60"
                style={{ background: duration === d.value ? "var(--primary)" : "var(--surface-2)", color: duration === d.value ? "white" : "var(--text-secondary)" }}>
                {d.label}<br /><span className="opacity-70">{d.credits} اعتبار</span>
              </button>
            ))}
          </div>
        </div>

        <button onClick={generate} disabled={isLoading || !prompt.trim()}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white disabled:opacity-50"
          style={{ background: "var(--primary)" }}>
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
          {isLoading ? "در حال ساخت موزیک..." : "ساخت موزیک"}
        </button>
      </div>

      {/* Progress */}
      {isLoading && (
        <div className="p-5 rounded-2xl space-y-3" style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between text-sm">
            <span style={{ color: "var(--text-secondary)" }}>در حال ساخت موزیک...</span>
            <span style={{ color: "var(--primary)" }}>{Math.round(progress)}%</span>
          </div>
          <div className="w-full rounded-full overflow-hidden" style={{ height: "6px", background: "var(--surface-2)" }}>
            <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${progress}%`, background: "linear-gradient(90deg, var(--primary), #f97316)" }} />
          </div>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>ممکن است ۱ تا ۳ دقیقه طول بکشد.</p>
        </div>
      )}

      {/* Audio Player */}
      {status === "succeeded" && audioUrl && (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)", background: "var(--surface-1)" }}>
          <div className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="w-4 h-4" style={{ color: "#10b981" }} />
              <span className="text-sm font-medium" style={{ color: "#10b981" }}>موزیک آماده است</span>
            </div>

            {/* Waveform Visual */}
            <div className="flex items-center gap-1 mb-4 h-12 justify-center">
              {Array.from({ length: 40 }, (_, i) => (
                <div key={i} className="rounded-full transition-all duration-300"
                  style={{
                    width: "3px",
                    height: `${20 + Math.sin(i * 0.5) * 15 + Math.random() * 10}px`,
                    background: playing && i < (currentTime / audioDuration) * 40
                      ? "var(--primary)"
                      : "var(--surface-3, var(--border))",
                  }} />
              ))}
            </div>

            {audioUrl && !audioUrl.includes("placehold.co") && (
              <audio ref={audioRef} src={audioUrl}
                onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
                onLoadedMetadata={() => setAudioDuration(audioRef.current?.duration || 0)}
                onEnded={() => setPlaying(false)} />
            )}

            {/* Controls */}
            <div className="flex items-center gap-3">
              <button onClick={togglePlay}
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: "var(--primary)" }}>
                {playing ? <Pause className="w-5 h-5 text-white" /> : <Play className="w-5 h-5 text-white ml-0.5" />}
              </button>

              {/* Seek bar */}
              <div className="flex-1 space-y-1">
                <input type="range" min={0} max={audioDuration || 100} value={currentTime}
                  onChange={e => { if (audioRef.current) { audioRef.current.currentTime = Number(e.target.value); setCurrentTime(Number(e.target.value)); } }}
                  className="w-full accent-orange-500" style={{ accentColor: "var(--primary)" }} />
                <div className="flex justify-between text-xs" style={{ color: "var(--text-muted)" }}>
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(audioDuration)}</span>
                </div>
              </div>

              <Volume2 className="w-4 h-4 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
            </div>
          </div>

          <div className="px-5 pb-4">
            <button onClick={downloadAudio} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-white" style={{ background: "var(--primary)" }}>
              <Download className="w-4 h-4" /> دانلود MP3
            </button>
          </div>
        </div>
      )}

      {status === "failed" && (
        <div className="p-4 rounded-2xl flex items-center gap-3" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}>
          <AlertCircle className="w-5 h-5 flex-shrink-0" style={{ color: "#ef4444" }} />
          <p className="text-sm flex-1" style={{ color: "#ef4444" }}>تولید موزیک ناموفق بود. دوباره تلاش کنید.</p>
          <button onClick={() => setStatus("idle")} className="px-3 py-1 rounded-lg text-xs" style={{ background: "rgba(239,68,68,0.2)", color: "#ef4444" }}>تلاش مجدد</button>
        </div>
      )}
    </div>
  );
}
