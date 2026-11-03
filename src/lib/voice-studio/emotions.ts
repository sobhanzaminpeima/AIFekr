/** Mood of the delivery, sent as an ElevenLabs audio tag ahead of the text on models that act on tags (not read aloud; measured 2026-11-03). */
export const VOICE_EMOTIONS = ["happy", "excited", "calm", "sad", "serious", "whispers"] as const;
export const supportsEmotion = (modelId: string) => /^eleven_v(3|4)/.test(modelId);
