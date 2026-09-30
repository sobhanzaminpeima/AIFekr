import { routedStreamChat } from "@/lib/ai/router";
import { hasSupportModel, streamSupportCompletion } from "./support/model";

/**
 * The planning model call: one small request that returns strict JSON naming
 * which tools should run.
 *
 * Free tier first. Planning is a classification task over a short catalogue —
 * exactly what the free Mistral/Groq models are good enough for — so doing it
 * on the free chain keeps `full_mode`'s added provider cost near zero. If no
 * free model is reachable it falls back to the platform's normal routed chain
 * rather than failing the user's turn: a planning step that can't run would
 * otherwise silently downgrade every business question to plain chat.
 *
 * Either way this adds no credit charge — /api/chat deducts once per message
 * regardless of how many internal calls a turn makes.
 *
 * Returns "" on total failure, which `parseProposedCalls` reads as "no tools",
 * so the turn degrades to an ordinary answer instead of erroring.
 */

const PLANNER_MAX_TOKENS = 400;

export async function callPlanner(system: string, user: string): Promise<string> {
  if (hasSupportModel()) {
    try {
      let text = "";
      await streamSupportCompletion([{ role: "user", content: user }], system, (chunk) => {
        text += chunk;
      });
      if (text.trim()) return text;
    } catch (err) {
      console.warn("[Orchestrator] free-tier planner unavailable, falling back to the routed chain:", err instanceof Error ? err.message : err);
    }
  }

  try {
    let text = "";
    await routedStreamChat(
      [{ role: "user", content: user }],
      system,
      (chunk) => {
        text += chunk;
      },
      () => {},
      undefined,
      ({ partial }) => {
        // A provider that failed mid-answer leaves half a JSON object behind;
        // discarding it is the difference between "no tools" and a parse of
        // truncated garbage.
        if (partial) text = "";
      },
      PLANNER_MAX_TOKENS
    );
    return text;
  } catch (err) {
    console.error("[Orchestrator] planner failed on every provider:", err);
    return "";
  }
}
