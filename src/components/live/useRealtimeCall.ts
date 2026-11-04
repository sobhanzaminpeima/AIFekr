"use client";
// AIFekr Live, live mode: one full-duplex voice call with OpenAI GPT-Live,
// relayed by the main site (browsers in Iran cannot reach OpenAI's media
// servers, but they reach aifekr.com). The microphone goes up as 24 kHz PCM
// chunks to /api/live/realtime/audio; the assistant's voice and both
// transcripts come down on /api/live/realtime/events. The server charges each
// started minute and ends the call when credit or time runs out.
// The same file as the new design's components/live-realtime-call.ts (AIFekrUI).
//
// GPT-Live listens while it speaks and decides itself when to stop for the
// user, so it needs the microphone as one continuous, undistorted stream
// (OpenAI's live WebSocket guide). Phones cancel the speaker's echo in the
// system, so there the microphone is always sent as it is. Computers may not
// (speakers without headphones): while the assistant speaks, the microphone is
// held back for a moment and sent as silence unless the user clearly talks,
// and then everything held, the first syllable included, is sent for real.
import { useCallback, useEffect, useRef, useState } from "react";

export type RealtimeInfo = { enabled: boolean; creditsPerMinute: number; maxMinutes: number; freeMinute: boolean };
type Handlers = {
  onUser: (delta: string) => void;
  onAssistant: (delta: string) => void;
  onLevel: (level: number) => void;
  onError: (code: string) => void;
  onEnded: () => void;
  /** The saved conversation this call is part of (new or continued). */
  onConversation?: (id: string) => void;
};
type Call = {
  id: string; stream: MediaStream; ctx: AudioContext; events: EventSource | null; processor: ScriptProcessorNode; source: MediaStreamAudioSourceNode;
  out: GainNode; playing: AudioBufferSourceNode[]; nextAt: number; pending: Int16Array[]; pendingLength: number; seq: number; frame: number;
  /** Echo gate (computers only): frames held while the assistant speaks, and how many loud frames in a row. */
  held: Float32Array[]; loudFrames: number;
  /** Loudest recent microphone frame, for telling the user's own voice from a late transcript. */
  recentLevel: number[];
  resampler: (input: Float32Array) => Float32Array;
};
/** Rate of the audio exchanged with the server, and how much microphone audio goes up per request (~250 ms). */
const RATE = 24000, CHUNK = RATE / 4;
/** Computers: input this loud for this many frames in a row (~170 ms each) counts as the user talking over the assistant. */
const BARGE_IN = 0.05, BARGE_FRAMES = 2, HOLD_FRAMES = 4;
/** The user is (still) talking when a recent frame was at least this loud. */
const VOICE_LEVEL = 0.012;
/** Audio waits this long before playing when a reply starts (and after a gap), so network jitter does not break it up. */
const JITTER_S = 0.3;

/** Phones and tablets: the system cancels the speaker's echo. */
function systemEchoCancel() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
}

const post = (url: string, body: BodyInit, type = "application/json") => fetch(url, { method: "POST", credentials: "include", keepalive: true, headers: { "Content-Type": type }, body });

/**
 * Microphone rate -> 24 kHz. Each output sample averages the input samples it
 * covers (a box low-pass), with the position carried across frames so the
 * stream stays continuous; picking every n-th sample folded high sounds into
 * the voice and blurred names.
 */
function makeResampler(rate: number) {
  if (rate === RATE) return (input: Float32Array) => input;
  const step = rate / RATE;
  let carry = new Float32Array(0), pos = 0;
  return (input: Float32Array) => {
    const data = new Float32Array(carry.length + input.length);
    data.set(carry);
    data.set(input, carry.length);
    const out: number[] = [];
    while (pos + step <= data.length) {
      // Each input sample counts by how much of it the window [pos, pos + step) covers.
      const a = pos, b = pos + step;
      let sum = 0;
      for (let i = Math.floor(a); i < Math.ceil(b) && i < data.length; i++) sum += data[i] * (Math.min(b, i + 1) - Math.max(a, i));
      out.push(sum / step);
      pos = b;
    }
    const keep = Math.floor(pos);
    carry = data.slice(keep);
    pos -= keep;
    return Float32Array.from(out);
  };
}
function toPcm(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const v = Math.max(-1, Math.min(1, input[i]));
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
const rms = (data: Float32Array) => { let s = 0; for (const v of data) s += v * v; return Math.sqrt(s / Math.max(1, data.length)); };

/** An audio context at 24 kHz where the browser allows it (it then resamples the microphone itself, properly). */
function newContext() {
  try { return new AudioContext({ sampleRate: RATE, latencyHint: "interactive" }); } catch { return new AudioContext(); }
}

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

  const start = useCallback(async (options: { voice?: string; conversationId?: string | null } = {}) => {
    if (call.current) return;
    setPhase("connecting");
    // Made and resumed inside the tap (before the microphone prompt): phones keep an audio
    // context made later suspended, and then neither the microphone nor the voice works.
    let ctx = newContext();
    void ctx.resume().catch(() => {});
    let stream: MediaStream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } }); }
    catch { void ctx.close(); setPhase("idle"); handlers.current.onError("NO_MIC"); return; }
    await ctx.resume().catch(() => {});
    let source: MediaStreamAudioSourceNode;
    try { source = ctx.createMediaStreamSource(stream); }
    catch {
      // Browsers that cannot connect a microphone to a 24 kHz context (Firefox): the default rate, resampled here.
      void ctx.close();
      ctx = new AudioContext();
      await ctx.resume().catch(() => {});
      source = ctx.createMediaStreamSource(stream);
    }
    const processor = ctx.createScriptProcessor(4096, 1, 1), out = ctx.createGain();
    out.connect(ctx.destination);
    const meter = ctx.createAnalyser();
    meter.fftSize = 512;
    out.connect(meter);
    source.connect(meter);
    const c: Call = { id: "", stream, ctx, events: null, processor, source, out, playing: [], nextAt: 0, pending: [], pendingLength: 0, seq: 0, frame: 0, held: [], loudFrames: 0, recentLevel: [], resampler: makeResampler(ctx.sampleRate) };
    call.current = c;
    let res: Response;
    try { res = await post("/api/live/realtime", JSON.stringify({ voice: options.voice, conversationId: options.conversationId ?? null })); }
    catch { await end(false); handlers.current.onError("LIVE_REALTIME_FAILED"); return; }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { await end(false); handlers.current.onError(data.error || "LIVE_REALTIME_FAILED"); return; }
    if (call.current !== c) { post("/api/live/realtime/close", JSON.stringify({ sessionId: data.sessionId })).catch(() => {}); return; }
    c.id = data.sessionId;
    if (data.conversationId) handlers.current.onConversation?.(data.conversationId);
    const echoGate = !systemEchoCancel();

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
        // A new reply (or one that ran dry) starts after a short buffer; the rest follows back to back.
        const at = c.nextAt > ctx.currentTime ? c.nextAt : ctx.currentTime + JITTER_S;
        node.start(at);
        c.nextAt = at + buffer.duration;
        c.playing.push(node);
        node.onended = () => { c.playing = c.playing.filter((x) => x !== node); };
      } else if (e.type === "user" && e.delta) {
        // GPT-Live stops answering when the user talks; what is still queued here is dropped too
        // (only while the user is audibly talking, so a late transcript of the last sentence cuts nothing).
        if (c.nextAt > ctx.currentTime && Math.max(0, ...c.recentLevel) >= VOICE_LEVEL) flush(c);
        handlers.current.onUser(e.delta);
      } else if (e.type === "assistant" && e.delta) handlers.current.onAssistant(e.delta);
      else if (e.type === "closed") void end();
    };
    events.onerror = () => { if (events.readyState === EventSource.CLOSED) void end(); };

    // Up: the microphone in ~250 ms chunks, numbered, one continuous stream.
    const upload = (chunk: Int16Array, seq: number, attempt = 0) => {
      fetch(`/api/live/realtime/audio?id=${encodeURIComponent(c.id)}&seq=${seq}`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/octet-stream" }, body: chunk.buffer as ArrayBuffer })
        .then((r) => { if (r.status === 404) void end(); else if (!r.ok && r.status >= 500 && attempt < 2 && call.current === c) setTimeout(() => upload(chunk, seq, attempt + 1), 250); })
        .catch(() => { if (attempt < 2 && call.current === c) setTimeout(() => upload(chunk, seq, attempt + 1), 250); });
    };
    const queue = (frame: Float32Array) => {
      const pcm = toPcm(c.resampler(frame));
      if (!pcm.length) return;
      c.pending.push(pcm);
      c.pendingLength += pcm.length;
      if (c.pendingLength < CHUNK) return;
      const chunk = new Int16Array(c.pendingLength);
      let offset = 0;
      for (const p of c.pending) { chunk.set(p, offset); offset += p.length; }
      c.pending = [];
      c.pendingLength = 0;
      upload(chunk, c.seq++);
    };
    processor.onaudioprocess = (ev) => {
      if (call.current !== c) return;
      const input = new Float32Array(ev.inputBuffer.getChannelData(0));
      const level = rms(input);
      c.recentLevel.push(level);
      if (c.recentLevel.length > 3) c.recentLevel.shift();
      if (!echoGate) { queue(input); return; }
      const speakingBack = c.nextAt > ctx.currentTime;
      c.loudFrames = level >= BARGE_IN ? c.loudFrames + 1 : 0;
      if (speakingBack && c.loudFrames < BARGE_FRAMES) {
        // Held for a moment; what leaves the hold unheard is the assistant's echo, sent as silence.
        c.held.push(input);
        if (c.held.length > HOLD_FRAMES) queue(new Float32Array(c.held.shift()!.length));
        return;
      }
      if (speakingBack) flush(c); // the user talks over the assistant: stop its voice here at once
      for (const f of c.held.splice(0)) queue(f); // the held start of what the user said, for real
      queue(input);
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
