"use client";
// AIFekr Live, live mode: one full-duplex voice call with OpenAI GPT-Live,
// relayed by the main site (browsers in Iran cannot reach OpenAI's media
// servers, but they reach aifekr.com). The microphone goes up as 24 kHz PCM
// chunks to /api/live/realtime/audio; the assistant's voice and both
// transcripts come down on /api/live/realtime/events. The server charges each
// started minute and ends the call when credit or time runs out.
// The same file as the new design's components/live-realtime-call.ts (AIFekrUI).
import { useCallback, useEffect, useRef, useState } from "react";

export type RealtimeInfo = { enabled: boolean; creditsPerMinute: number; maxMinutes: number; freeMinute: boolean };
type Handlers = {
  onUser: (delta: string) => void;
  onAssistant: (delta: string) => void;
  onLevel: (level: number) => void;
  onError: (code: string) => void;
  onEnded: () => void;
};
type Call = {
  id: string; stream: MediaStream; ctx: AudioContext; events: EventSource | null; processor: ScriptProcessorNode; source: MediaStreamAudioSourceNode;
  out: GainNode; playing: AudioBufferSourceNode[]; nextAt: number; pending: Int16Array[]; pendingLength: number; upload: Promise<unknown>; frame: number;
};
/** Rate of the audio exchanged with the server, and how much microphone audio goes up per request. */
const RATE = 24000, CHUNK = RATE / 4;
/** While the assistant is speaking, quieter microphone input is treated as its echo and sent as silence; louder input interrupts it. */
const BARGE_IN = 0.06;

const post = (url: string, body: BodyInit, type = "application/json") => fetch(url, { method: "POST", credentials: "include", keepalive: true, headers: { "Content-Type": type }, body });

function toPcm24k(input: Float32Array, rate: number): Int16Array {
  const ratio = rate / RATE, out = new Int16Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const v = Math.max(-1, Math.min(1, input[Math.floor(i * ratio)]));
    out[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
  }
  return out;
}
function fromBase64Pcm(b64: string): Float32Array<ArrayBuffer> {
  const bin = atob(b64), bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const pcm = new Int16Array(bytes.buffer, 0, bytes.length >> 1), out = new Float32Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) out[i] = pcm[i] / 0x8000;
  return out;
}
const rms = (data: Float32Array) => { let s = 0; for (const v of data) s += v * v; return Math.sqrt(s / data.length); };

export function useRealtimeCall(h: Handlers) {
  const handlers = useRef(h);
  useEffect(() => { handlers.current = h; });
  const call = useRef<Call | null>(null);
  const [phase, setPhase] = useState<"idle" | "connecting" | "live">("idle");
  const [startedAt, setStartedAt] = useState(0);

  const flush = (c: Call) => { c.playing.forEach((s) => { try { s.stop(); } catch { /* ended */ } }); c.playing = []; c.nextAt = 0; };

  const end = useCallback(async (notify = true) => {
    const c = call.current;
    if (!c) return;
    call.current = null;
    cancelAnimationFrame(c.frame);
    c.events?.close();
    flush(c);
    c.processor.disconnect();
    c.source.disconnect();
    c.stream.getTracks().forEach((t) => t.stop());
    void c.ctx.close();
    if (c.id) post("/api/live/realtime/close", JSON.stringify({ sessionId: c.id })).catch(() => {});
    setPhase("idle");
    handlers.current.onLevel(0);
    if (notify) handlers.current.onEnded();
  }, []);

  const start = useCallback(async () => {
    if (call.current) return;
    setPhase("connecting");
    let stream: MediaStream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
    catch { setPhase("idle"); handlers.current.onError("NO_MIC"); return; }
    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream), processor = ctx.createScriptProcessor(4096, 1, 1), out = ctx.createGain();
    out.connect(ctx.destination);
    const meter = ctx.createAnalyser();
    meter.fftSize = 512;
    out.connect(meter);
    source.connect(meter);
    const c: Call = { id: "", stream, ctx, events: null, processor, source, out, playing: [], nextAt: 0, pending: [], pendingLength: 0, upload: Promise.resolve(), frame: 0 };
    call.current = c;
    let res: Response;
    try { res = await post("/api/live/realtime", "{}"); }
    catch { await end(false); handlers.current.onError("LIVE_REALTIME_FAILED"); return; }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { await end(false); handlers.current.onError(data.error || "LIVE_REALTIME_FAILED"); return; }
    if (call.current !== c) { post("/api/live/realtime/close", JSON.stringify({ sessionId: data.sessionId })).catch(() => {}); return; }
    c.id = data.sessionId;

    // Down: the assistant's voice, scheduled back to back as it arrives.
    const events = new EventSource(`/api/live/realtime/events?id=${encodeURIComponent(c.id)}`, { withCredentials: true });
    c.events = events;
    events.onmessage = (m) => {
      let e: { type?: string; data?: string; delta?: string };
      try { e = JSON.parse(m.data); } catch { return; }
      if (e.type === "audio" && e.data) {
        const samples = fromBase64Pcm(e.data);
        if (!samples.length) return;
        const buffer = ctx.createBuffer(1, samples.length, RATE);
        buffer.copyToChannel(samples, 0);
        const node = ctx.createBufferSource();
        node.buffer = buffer;
        node.connect(out);
        const at = Math.max(ctx.currentTime + 0.05, c.nextAt);
        node.start(at);
        c.nextAt = at + buffer.duration;
        c.playing.push(node);
        node.onended = () => { c.playing = c.playing.filter((x) => x !== node); };
      } else if (e.type === "user" && e.delta) handlers.current.onUser(e.delta);
      else if (e.type === "assistant" && e.delta) handlers.current.onAssistant(e.delta);
      else if (e.type === "closed") void end();
    };
    events.onerror = () => { if (events.readyState === EventSource.CLOSED) void end(); };

    // Up: the microphone in ~250 ms chunks, in order.
    processor.onaudioprocess = (ev) => {
      if (call.current !== c) return;
      const input = ev.inputBuffer.getChannelData(0);
      const speakingBack = c.nextAt > ctx.currentTime;
      const loud = rms(input) >= BARGE_IN;
      if (speakingBack && loud) flush(c); // the user talks over the assistant
      const pcm = toPcm24k(speakingBack && !loud ? new Float32Array(input.length) : input, ctx.sampleRate);
      c.pending.push(pcm);
      c.pendingLength += pcm.length;
      if (c.pendingLength < CHUNK) return;
      const chunk = new Int16Array(c.pendingLength);
      let offset = 0;
      for (const p of c.pending) { chunk.set(p, offset); offset += p.length; }
      c.pending = [];
      c.pendingLength = 0;
      c.upload = c.upload.then(() => fetch(`/api/live/realtime/audio?id=${encodeURIComponent(c.id)}`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/octet-stream" }, body: chunk.buffer }).then((r) => { if (r.status === 404) void end(); }).catch(() => {}));
    };
    source.connect(processor);
    processor.connect(ctx.destination);

    const samples = new Uint8Array(512);
    const tick = () => {
      if (call.current !== c) return;
      meter.getByteTimeDomainData(samples);
      let sum = 0;
      for (const v of samples) sum += ((v - 128) / 128) ** 2;
      handlers.current.onLevel(Math.min(1, Math.sqrt(sum / samples.length) * 6));
      c.frame = requestAnimationFrame(tick);
    };
    c.frame = requestAnimationFrame(tick);
    setStartedAt(Date.now());
    setPhase("live");
  }, [end]);

  useEffect(() => {
    const leave = () => { const c = call.current; if (c?.id) navigator.sendBeacon("/api/live/realtime/close", new Blob([JSON.stringify({ sessionId: c.id })], { type: "text/plain" })); };
    window.addEventListener("pagehide", leave);
    return () => { window.removeEventListener("pagehide", leave); void end(false); };
  }, [end]);

  return { phase, startedAt, start, end };
}
