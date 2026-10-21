// Face detection gate for the Character Creator feature (image/character-board).
//
// Nothing in this codebase does face detection today (checked before building
// this) — no face-api.js, no Rekognition, no dedicated vision model call
// anywhere. Rather than add a new ML dependency, this reuses the OpenAI key
// already configured for image generation: one cheap gpt-4o-mini vision call
// that answers a single yes/no question. "No face, no generation" is a
// stated non-negotiable for this feature, so a failed/ambiguous check must
// block generation, never silently pass it through.

const hasOpenAI = !!(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.length > 10);

export interface FaceCheckResult {
  hasClearFace: boolean;
  /** Only set when hasClearFace is false, for the inline error message. */
  reason?: string;
}

export async function checkForClearFace(imageUrl: string): Promise<FaceCheckResult> {
  // Dev/unconfigured fallback matches the same "assume best case, don't block
  // local development" pattern the image providers themselves use.
  if (!hasOpenAI) return { hasClearFace: true };

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 20,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Does this image contain exactly one clear, mostly-unobstructed human face (not a group photo, not a cartoon/drawing, not heavily obscured by sunglasses/masks/hats/hands)? Answer with only one word: YES or NO.",
              },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      // A check we couldn't run is not a check that passed -- block rather
      // than guess, same rule this project already applies to FX rates.
      return { hasClearFace: false, reason: "check_failed" };
    }
    const data = await res.json();
    const answer = (data.choices?.[0]?.message?.content || "").trim().toUpperCase();
    return { hasClearFace: answer.startsWith("YES"), reason: answer.startsWith("YES") ? undefined : "no_clear_face" };
  } catch {
    return { hasClearFace: false, reason: "check_failed" };
  }
}
