import { execFile } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { VoiceError } from "./domain";
function command(binary: string, args: string[], maxBuffer: number) { return new Promise<Buffer>((resolve, reject) => execFile(binary, args, { encoding: "buffer", timeout: 20000, maxBuffer, windowsHide: true }, (error, stdout) => error ? reject(new VoiceError("AUDIO_VALIDATION_FAILED", 503)) : resolve(stdout))); }
export async function inspectAudio(bytes: Buffer) {
    const directory = await mkdtemp(path.join(tmpdir(), "aifekr-voice-")), file = path.join(directory, "audio.mp3");
    try {
        await writeFile(file, bytes);
        const metadata = JSON.parse((await command(process.env.FFPROBE_PATH || "ffprobe", ["-v", "error", "-show_entries", "format=duration:stream=codec_type", "-of", "json", file], 65536)).toString());
        const duration = Number(metadata.format?.duration);
        if (!Number.isFinite(duration) || duration <= 0 || !metadata.streams?.some((s: {
            codec_type: string;
        }) => s.codec_type === "audio"))
            throw new VoiceError("INVALID_AUDIO");
        const pcm = await command(process.env.FFMPEG_PATH || "ffmpeg", ["-v", "error", "-i", file, "-t", "61", "-ac", "1", "-ar", "1000", "-f", "f32le", "pipe:1"], 300000);
        const samples = Math.floor(pcm.length / 4), waveform = Array.from({ length: 80 }, (_, i) => { let max = 0; for (let j = Math.floor(i * samples / 80); j < Math.floor((i + 1) * samples / 80); j++)
            max = Math.max(max, Math.abs(pcm.readFloatLE(j * 4))); return Math.min(1, Number(max.toFixed(3))); });
        return { durationMs: Math.ceil(duration * 1000), waveform };
    }
    finally {
        await rm(directory, { recursive: true, force: true });
    }
}
