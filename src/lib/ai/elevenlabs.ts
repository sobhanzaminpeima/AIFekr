interface ElevenLabsMusicOptions {
  prompt: string;
  durationMs: number;
}

interface ElevenLabsMusicResult {
  buffer: Buffer;
  contentType: string;
}

/**
 * ElevenLabs' music endpoint is synchronous — it returns the finished audio
 * bytes directly in the response body, unlike Replicate's async
 * prediction+webhook flow. Returns null (not throws) when no key is
 * configured, so callers can fall back to Replicate.
 */
export async function generateMusicElevenLabs(
  opts: ElevenLabsMusicOptions
): Promise<ElevenLabsMusicResult | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return null;

  const musicLengthMs = Math.min(600_000, Math.max(3_000, opts.durationMs));

  const res = await fetch("https://api.elevenlabs.io/v1/music", {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: opts.prompt,
      music_length_ms: musicLengthMs,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ElevenLabs music ${res.status}: ${err.slice(0, 300)}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") || "audio/mpeg";
  return { buffer, contentType };
}
