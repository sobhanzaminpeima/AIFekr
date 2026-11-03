# AIFekr Live: plan for a truly live voice conversation

Date: 2026-11-03. Current state: `/live` records one turn at a time. The pipeline is speech to text (OpenAI), then an answer (OpenAI `gpt-5.4-nano`), then speech (ElevenLabs `eleven_v4_turbo`, sentence by sentence). Measured: an answer takes ~1.5 s and speech roughly 2–6 s. The user can't interrupt mid-answer.

## Options (from OpenAI's official documentation, checked 2026-11-03)

| | A) `gpt-live-1` (Live API) | B) `gpt-realtime-2.1-mini` (Realtime API) | C) Improve the current pipeline |
|---|---|---|---|
| What it is | Full-duplex speech-to-speech; can listen and speak at once; can hand work to a backend model | Speech-to-speech with built-in turn detection | Keep STT → LLM → TTS, but stream it |
| Price | **$0.05/minute, billed per second**. Backend model and tools are billed separately. Session start bills 15 s, which counts toward the session. | $10 / $20 per 1M input / output audio tokens. A third-party measurement puts the real cost at ~$0.06–0.15/minute (unverified) | Same as today: about $0.01 per turn |
| Persian | **Not confirmed.** The listed voices are English, Portuguese, German, French, Hindi, Japanese and Korean | Not documented for Persian; it must be tested | Persian already works (`eleven_v4_turbo`) |
| Latency | Under a second, with interruption | Under a second, with interruption | 2–4 s |
| Billing control | Server makes the session (`POST /v1/live/sessions`, SDP relayed through our server); server attaches via `wss://…/v1/live/sessions/{id}/attach`; `session.closed` reports `usage.seconds` | Ephemeral key + `/v1/realtime/calls`. Usage tokens arrive in events. A server sideband via `call_id` has documented problems with ephemeral keys | Per turn, as today |

Sources:
- [GPT-Live 1 model](https://developers.openai.com/api/docs/models/gpt-live-1)
- [Voice over WebRTC](https://developers.openai.com/api/docs/guides/voice-webrtc)
- [Server-side controls](https://developers.openai.com/api/docs/guides/voice-server-controls)
- [Live conversations](https://developers.openai.com/api/docs/guides/live-conversations)
- [OpenAI pricing](https://developers.openai.com/api/docs/pricing)

## Recommendation
1. **Pilot first (one day, about $1):**
   - Run 10 Persian conversations on A and on B, using the owner's own test account.
   - Measure: speech-recognition quality, Persian pronunciation, latency, and real cost per minute.
   - Without good Persian there's no point switching.
2. **If A passes the Persian test:** build on A. Per-second billing makes margin control simple and safe.
3. **If neither speaks Persian well:**
   - Persian keeps the current pipeline, made faster with improvement C.
   - English, German and Turkish move to A.

## Architecture (option A)
- **Session:**
  - The browser creates its WebRTC offer and sends it to `POST /api/live/realtime/session`.
  - Our server checks the user, credit balance and limits, reserves credits for the first block (e.g. 2 minutes), and calls OpenAI with our key.
  - It returns the SDP answer. The key never reaches the browser.
- **Trusted metering:** our worker attaches to the session over the sideband.
  - **Every minute:** it charges the next block from credits through the existing ledger (`reserveLoggedCredits`).
  - **When credit runs out:** it first says a short closing message, then sends `session.close`.
  - **At the end:** it settles from the final `usage.seconds` and refunds the unused part.
- **Limits:**
  - Max session length (e.g. 10 minutes; admin-configurable).
  - One session per user at a time.
  - Daily cap for free users.
- **Instructions:** the current AIFekr Live identity and colloquial tone, plus the user's business profile (opt-in) so it can help in their own field.
- **Screen:** the same `/live` screen in both themes; only the "live mode" changes. If live mode is unavailable, it falls back to the current mode.

## Price (65% target margin)
- **Basis:** revenue needed = cost ÷ 0.35. The cheapest purchasable credit is about $0.00216.
- **A at $0.05/minute:** about $0.143/minute is needed, i.e. **~66 credits per minute**. If a backend model is used for delegation, add its token cost.
- **B: set only after the pilot**, from real cost. On the unverified range it would be ~83–193 credits per minute.
- **No price goes live without the owner's approval.**

## Decisions needed from the owner
1. Approve the pilot (~$1 test cost).
2. Free allowance for live mode (e.g. 1 minute for new users).
3. Max session length.

## Phases
| Phase | Work | Acceptance |
|---|---|---|
| 0 | Pilot A/B in Persian and English | Quality and latency report with measured real cost |
| 1 | Session endpoint + server sideband + per-minute block charging + automatic close | Tests: low balance, connection drop, double session, final settlement; ledger drift stays zero |
| 2 | Live mode in the screen (both themes) with interruption and fallback | Works on mobile Chrome/Safari |
| 3 | Admin: price per minute, max length, free allowance, live-minutes report and real margin | Values change without a deploy |

## Pilot results (2026-11-03, on the server, test questions only, about $0.25 actual cost)
Setup:
- Four fixed questions (three Persian, one English), spoken with ElevenLabs.
- Each was streamed live to both models.
- Each spoken answer was transcribed again separately, to check pronunciation.

| | `gpt-live-1` | `gpt-realtime-2.1-mini` |
|---|---|---|
| Delay after the user stops | **0.04–0.42 s** (measured on the audio timeline) | ~1.0–1.2 s |
| Persian tone | Natural and colloquial: «آره، می‌فهمم، بعضی روزا واقعاً سنگینن…» | Mostly OK, but more formal and less smooth |
| Persian pronunciation | The independent transcript matched the model's own text almost word for word | Several mispronounced words (e.g. «قدم» was heard as «کادنه») |
| Identity ("who are you") | Correct; it said «AIFekr» like «ایسک» | Correct; it said «AIFekr» like «AI فیک» |
| Language | It answered the English question in Persian (does not follow "same language") | It answered English in English |
| Stability | 1 of 6 runs gave no answer; both retries were fine | 4 of 4 fine |
| Cost | $0.05 per minute of open session (listening included) | Per token: one 10–20 s answer ≈ ~1,000 tokens, roughly $0.005–0.01 |

Conclusion:
- **`gpt-live-1` is clearly better for a Persian conversation** (speed, tone, pronunciation).
- Three fixes are needed before launch:
  1. The prompt should state the user's language explicitly, and the brand pronunciation («ای آی فکر»).
  2. The screen should reconnect and retry automatically if there is no answer.
  3. Billing should be per minute of open session, since listening time is billed too.

Proposed price: ~66 credits per minute (65% margin at the cheapest credit). It needs the owner's approval.
