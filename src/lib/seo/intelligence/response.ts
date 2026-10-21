/** Bounded transport reader shared by paid tasks and free provider metadata. */
export async function readSeoJson(response: Response, maxBytes = 2_000_000): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw Error("INVALID_PROVIDER_RESPONSE");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        throw Error("PROVIDER_RESPONSE_TOO_LARGE");
      }
      chunks.push(next.value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally { reader.releaseLock(); }
}
