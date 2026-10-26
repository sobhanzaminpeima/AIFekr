import { VoiceError } from "./domain";
export async function boundedJson(req: Request, limit = 1000000) {
    if (Number(req.headers.get("content-length")) > limit)
        throw new VoiceError("PAYLOAD_TOO_LARGE", 413);
    const reader = req.body?.getReader();
    if (!reader)
        throw new VoiceError("INVALID_INPUT", 400);
    const parts: Uint8Array[] = [];
    let size = 0;
    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done)
                break;
            size += value.length;
            if (size > limit) {
                await reader.cancel();
                throw new VoiceError("PAYLOAD_TOO_LARGE", 413);
            }
            parts.push(value);
        }
    }
    finally {
        reader.releaseLock();
    }
    try {
        return JSON.parse(Buffer.concat(parts).toString("utf8"));
    }
    catch {
        throw new VoiceError("INVALID_INPUT", 400);
    }
}
