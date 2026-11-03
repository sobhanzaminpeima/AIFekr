"use client";
// AIFekr Live in the classic theme: the same screen as the new design's
// components/live-talk.tsx (AIFekrUI), on /api/live (bootstrap) and
// /api/live/turn (speech -> answer -> speech, charged per turn from credits).
// The conversation stays in this tab.
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Mic, MessageSquare, Pause, Square } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useLiveCredits } from "@/lib/credits/live";

type Voice = { id: string; name: string; gender: string };
type Boot = { enabled: boolean; voices: Voice[]; costs: { turn: number; per100: number }; credits: number; typicalTurn: number };
type Turn = { role: "user" | "assistant"; content: string };
type State = "idle" | "listening" | "thinking" | "speaking" | "paused";

const COPY = {
  title: ["AIFekr Live", "AIFekr Live", "AIFekr Live", "AIFekr Live"],
  intro: ["درباره هر موضوعی با هوش مصنوعی حرف بزنید؛ با صدا جواب می‌دهد.", "Talk with AI about anything; it answers out loud.", "Sprechen Sie mit der KI über jedes Thema; sie antwortet laut.", "Yapay zekâyla her konuda konuşun; sesli yanıt verir."],
  idle: ["برای شروع، روی میکروفون بزنید", "Tap the microphone to start", "Tippen Sie zum Start auf das Mikrofon", "Başlamak için mikrofona dokunun"],
  listening: ["دارم گوش می‌دهم…", "Listening…", "Ich höre zu…", "Dinliyorum…"],
  thinking: ["دارم فکر می‌کنم…", "Thinking…", "Ich denke nach…", "Düşünüyorum…"],
  speaking: ["دارم جواب می‌دهم…", "Answering…", "Ich antworte…", "Yanıtlıyorum…"],
  paused: ["متوقف شد؛ برای ادامه روی میکروفون بزنید", "Paused; tap the microphone to continue", "Pausiert; zum Fortsetzen auf das Mikrofon tippen", "Duraklatıldı; devam etmek için mikrofona dokunun"],
  voice: ["صدای گوینده", "Voice", "Stimme", "Ses"],
  female: ["زن", "female", "weiblich", "kadın"],
  male: ["مرد", "male", "männlich", "erkek"],
  credits: ["اعتبار باقی‌مانده", "Credits left", "Verbleibende Credits", "Kalan kredi"],
  perTurn: ["هر نوبت حدود {n} اعتبار", "About {n} credits per turn", "Etwa {n} Credits pro Runde", "Tur başına yaklaşık {n} kredi"],
  type: ["نوشتن به‌جای صحبت", "Type instead", "Stattdessen tippen", "Bunun yerine yaz"],
  send: ["ارسال", "Send", "Senden", "Gönder"],
  placeholder: ["پیامتان را بنویسید…", "Type your message…", "Nachricht eingeben…", "Mesajınızı yazın…"],
  pause: ["توقف", "Pause", "Pause", "Duraklat"],
  mic: ["شروع یا پایان صحبت", "Start or finish speaking", "Sprechen starten oder beenden", "Konuşmayı başlat veya bitir"],
  transcript: ["متن گفتگو", "Transcript", "Verlauf", "Konuşma metni"],
  you: ["شما", "You", "Sie", "Siz"],
  newTalk: ["گفتگوی تازه", "New conversation", "Neues Gespräch", "Yeni konuşma"],
  noMic: ["دسترسی به میکروفون داده نشد. از تنظیمات مرورگر اجازه دهید یا بنویسید.", "Microphone access was denied. Allow it in the browser, or type instead.", "Kein Mikrofonzugriff. Erlauben Sie ihn im Browser oder tippen Sie.", "Mikrofon izni verilmedi. Tarayıcıdan izin verin veya yazın."],
  unavailable: ["AIFekr Live فعلاً در دسترس نیست. کمی بعد دوباره امتحان کنید.", "AIFekr Live is unavailable right now. Please try again later.", "AIFekr Live ist gerade nicht verfügbar. Bitte später erneut versuchen.", "AIFekr Live şu anda kullanılamıyor. Lütfen daha sonra deneyin."],
  lowCredit: ["اعتبار کافی برای یک نوبت دیگر ندارید.", "You don't have enough credits for another turn.", "Ihre Credits reichen für keine weitere Runde.", "Bir tur daha için yeterli krediniz yok."],
  buy: ["خرید اعتبار", "Buy credits", "Credits kaufen", "Kredi satın al"],
  noSpeech: ["صدایی نشنیدم؛ دوباره بگویید.", "I didn't hear anything; please say it again.", "Ich habe nichts gehört; bitte noch einmal.", "Bir şey duymadım; lütfen tekrar söyleyin."],
  failed: ["این نوبت انجام نشد و اعتباری کسر نشد. دوباره امتحان کنید.", "That turn didn't go through and no credits were charged. Please try again.", "Diese Runde hat nicht geklappt, es wurden keine Credits berechnet. Bitte erneut versuchen.", "Bu tur tamamlanamadı ve kredi düşülmedi. Lütfen tekrar deneyin."],
  busy: ["لحظه‌ای صبر کنید و دوباره امتحان کنید.", "Please wait a moment and try again.", "Bitte kurz warten und erneut versuchen.", "Lütfen biraz bekleyip tekrar deneyin."],
} as const;
const LOCALES = ["fa", "en", "de", "tr"] as const;
/** Recording stops on its own after this much quiet following speech, or at the hard limit. */
const SILENCE_MS = 1500, MAX_RECORD_MS = 60000, SPEECH_LEVEL = 0.04;

export default function LiveTalk() {
  const { lang: locale } = useTranslation();
  const n = (v: number) => v.toLocaleString(locale === "fa" ? "fa-IR" : locale);
  const say = (key: keyof typeof COPY) => COPY[key][Math.max(0, LOCALES.indexOf(locale as (typeof LOCALES)[number]))];
  const [boot, setBoot] = useState<Boot | null>(null);
  const [failed, setFailed] = useState(false);
  const [voiceId, setVoiceId] = useState("");
  const [state, setState] = useState<State>("idle");
  const [level, setLevel] = useState(0);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [notice, setNotice] = useState<{ text: string; buy?: boolean } | null>(null);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const [showTranscript, setShowTranscript] = useState(false);
  const credits = useLiveCredits(boot?.credits ?? 0);
  const stateRef = useRef<State>("idle");
  const media = useRef<{ recorder: MediaRecorder; stream: MediaStream; ctx: AudioContext; frame: number; timer: number } | null>(null);
  const player = useRef<HTMLAudioElement | null>(null);
  const turnsRef = useRef<Turn[]>([]);
  const go = (s: State) => { stateRef.current = s; setState(s); };

  useEffect(() => {
    fetch("/api/live", { credentials: "include", cache: "no-store" }).then((r) => (r.ok ? r.json() : Promise.reject())).then((d: Boot) => {
      setBoot(d);
      let saved = ""; try { saved = localStorage.getItem("aifekr-live-voice") || ""; } catch { /* private mode */ }
      setVoiceId(d.voices.some((v) => v.id === saved) ? saved : d.voices[0]?.id || "");
    }).catch(() => setFailed(true));
    return () => { stopRecording(true); player.current?.pause(); };
  }, []);

  const send = useCallback(async (input: { audio?: Blob; text?: string }) => {
    go("thinking");
    setNotice(null);
    const form = new FormData();
    if (input.audio) form.set("audio", new File([input.audio], "speech.webm", { type: input.audio.type || "audio/webm" }));
    if (input.text) form.set("text", input.text);
    form.set("voiceId", voiceId);
    form.set("history", JSON.stringify(turnsRef.current.slice(-12)));
    try {
      const res = await fetch("/api/live/turn", { method: "POST", body: form, credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const code = data.error as string;
        setNotice(code === "INSUFFICIENT_CREDITS" ? { text: say("lowCredit"), buy: true } : code === "NO_SPEECH" || code === "EMPTY_TURN" ? { text: say("noSpeech") } : code === "RATE_LIMITED" ? { text: say("busy") } : code === "LIVE_UNAVAILABLE" ? { text: say("unavailable") } : { text: say("failed") });
        go("idle");
        return;
      }
      const next = [...turnsRef.current, { role: "user" as const, content: data.transcript }, { role: "assistant" as const, content: data.reply }];
      turnsRef.current = next;
      setTurns(next);
      window.dispatchEvent(new Event("aifekr:credits-refresh"));
      // The answer arrives as consecutive sentences, played one after another.
      const parts: string[] = Array.isArray(data.audio) ? data.audio : [data.audio];
      go("speaking");
      const play = (i: number) => {
        if (stateRef.current !== "speaking") return;
        if (i >= parts.length) { go("idle"); void startRecording(); return; }
        const audio = new Audio(`data:audio/mpeg;base64,${parts[i]}`);
        player.current = audio;
        audio.onended = () => play(i + 1);
        audio.play().catch(() => go("idle"));
      };
      play(0);
    } catch {
      setNotice({ text: say("failed") });
      go("idle");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceId, locale]);

  function stopRecording(discard = false) {
    const m = media.current;
    if (!m) return;
    media.current = null;
    cancelAnimationFrame(m.frame);
    clearTimeout(m.timer);
    if (discard) m.recorder.onstop = null;
    if (m.recorder.state !== "inactive") m.recorder.stop();
    m.stream.getTracks().forEach((t) => t.stop());
    void m.ctx.close();
    setLevel(0);
  }

  async function startRecording() {
    if (!boot?.enabled || media.current) return;
    let stream: MediaStream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
    catch { setNotice({ text: say("noMic") }); go("idle"); return; }
    const type = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((t) => MediaRecorder.isTypeSupported(t));
    const recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined), chunks: Blob[] = [];
    const ctx = new AudioContext(), analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const samples = new Uint8Array(analyser.fftSize);
    let heard = false, quietSince = 0;
    const tick = () => {
      analyser.getByteTimeDomainData(samples);
      let sum = 0;
      for (const s of samples) sum += ((s - 128) / 128) ** 2;
      const rms = Math.sqrt(sum / samples.length);
      setLevel(Math.min(1, rms * 6));
      const now = performance.now();
      if (rms > SPEECH_LEVEL) { heard = true; quietSince = 0; }
      else if (heard) { quietSince ||= now; if (now - quietSince > SILENCE_MS) { stopRecording(); return; } }
      if (media.current) media.current.frame = requestAnimationFrame(tick);
    };
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    recorder.onstop = () => {
      if (!heard) { go(stateRef.current === "paused" ? "paused" : "idle"); return; }
      void send({ audio: new Blob(chunks, { type: recorder.mimeType || "audio/webm" }) });
    };
    recorder.start(250);
    media.current = { recorder, stream, ctx, frame: requestAnimationFrame(tick), timer: window.setTimeout(() => stopRecording(), MAX_RECORD_MS) };
    go("listening");
  }

  function onMic() {
    if (state === "listening") { stopRecording(); return; }
    if (state === "speaking") { player.current?.pause(); go("idle"); }
    if (state === "thinking") return;
    void startRecording();
  }
  function onPause() {
    stopRecording(true);
    player.current?.pause();
    go("paused");
  }
  function onNew() {
    onPause();
    turnsRef.current = [];
    setTurns([]);
    setNotice(null);
    go("idle");
  }
  function chooseVoice(id: string) {
    setVoiceId(id);
    try { localStorage.setItem("aifekr-live-voice", id); } catch { /* private mode */ }
  }

  if (failed) return <section className="live-talk"><p className="live-talk-status">{say("unavailable")}</p></section>;
  if (!boot) return <section className="live-talk"><p role="status" className="live-talk-status">…</p></section>;
  const busy = state === "thinking";
  return (
    <section className="live-talk" data-state={state} dir={locale === "fa" ? "rtl" : "ltr"}>
      <header className="live-talk-head">
        <div>
          <h1>{say("title")}</h1>
          <p>{say("intro")}</p>
        </div>
        <div className="live-talk-meta">
          <label>
            <span>{say("voice")}</span>
            <select value={voiceId} onChange={(e) => chooseVoice(e.target.value)} disabled={state === "listening" || busy}>
              {boot.voices.map((v) => <option key={v.id} value={v.id}>{v.name} · {say(v.gender === "male" ? "male" : "female")}</option>)}
            </select>
          </label>
          <span>{say("credits")}: <strong>{n(credits)}</strong></span>
          <small>{say("perTurn").replace("{n}", n(boot.typicalTurn))}</small>
        </div>
      </header>

      <div className="live-talk-stage">
        <div className="live-orb" style={{ ["--level" as string]: String(level) }} aria-hidden="true" />
        <p className="live-talk-status" role="status" aria-live="polite">{boot.enabled ? say(state) : say("unavailable")}</p>
        {notice && <p className="live-talk-notice" role="alert">{notice.text} {notice.buy && <Link href="/credits">{say("buy")}</Link>}</p>}
      </div>

      {typing && (
        <form className="live-talk-type" onSubmit={(e) => { e.preventDefault(); const text = draft.trim(); if (!text || busy) return; setDraft(""); stopRecording(true); player.current?.pause(); void send({ text }); }}>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={say("placeholder")} maxLength={2000} autoFocus />
          <button className="live-send" disabled={busy || !draft.trim()}>{say("send")}</button>
        </form>
      )}

      <div className="live-talk-controls">
        <button className="live-ctl" onClick={() => setTyping((v) => !v)} aria-pressed={typing} aria-label={say("type")} title={say("type")}><MessageSquare size={20} /></button>
        <button className="live-ctl live-mic" onClick={onMic} disabled={!boot.enabled || busy} aria-label={say("mic")} title={say("mic")}>
          {state === "listening" ? <Square size={26} /> : <Mic size={26} />}
        </button>
        <button className="live-ctl" onClick={onPause} disabled={state === "idle" || state === "paused"} aria-label={say("pause")} title={say("pause")}><Pause size={20} /></button>
      </div>

      {turns.length > 0 && (
        <div className="live-talk-transcript">
          <div className="row-between">
            <button className="text-link" onClick={() => setShowTranscript((v) => !v)} aria-expanded={showTranscript}>{say("transcript")} ({n(turns.length / 2)})</button>
            <button className="text-link" onClick={onNew}>{say("newTalk")}</button>
          </div>
          {showTranscript && turns.map((t, i) => (
            <p key={i} className={t.role === "user" ? "live-line you" : "live-line"} dir="auto"><strong>{t.role === "user" ? say("you") : say("title")}:</strong> {t.content}</p>
          ))}
        </div>
      )}
    </section>
  );
}
