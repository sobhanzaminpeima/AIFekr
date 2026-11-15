# Video Factory: long-video price proposal (draft, not applied)

Status: **applied 2026-11-14 (option A, 500 credits/min).**

What went live: `packageRequired: false`, `narratedBundlesOnly: false`, `saleCents: 500` per 60 s.
- The credit rate is derived from `referencePlanCode` VF_STARTER, at about 1 cent per credit. No active pack sells at 0.216 cents; the cheapest is about 0.30 cents. So `saleCents` 108 would have given only about 108 credits per minute.
- `saleCents` 500 gives 500 credits per minute: 60 s = 501, 300 s = 2,501, 480 s = 4,001 credits.
- At the cheapest pack, 500 credits are about $1.48, above the $1.08 target price.
- Admin margin reports show $5/min, because that figure uses the reference pack's rate, not the wallet price actually paid.
- The backup and rollback are on the server under `/root/vf-pricing/`.

## What the owner asked for

- Long image videos (5–10 minutes, 70–100+ images) are paid from the normal credit wallet.
- If the balance is short, the user buys credits right there. That flow is built: the cost step shows credit packs and returns the user to the factory after payment.

## Cost basis

All costs come from the production rate card (`videoFactoryPolicy`, checked 2026-10-20), per minute of finished video.

| Item | Basis | Cost per minute |
| --- | --- | --- |
| Script and research (Llama 3.3 70B, Cloudflare) | rate card token rates | $0.033 |
| 10 images, Flux Schnell (current provider) | $0.00063 per image | $0.006 |
| 10 images, Gemini image (needed for the fixed character) | about $0.039 per image (**to verify**: the rate card has no price for this model) | $0.39 |
| Narration, ElevenLabs | about 800 characters × $0.08 per 1k | $0.064 |
| Render and platform | rate card estimate (`infrastructureMeasured: false`) | $0.20 |

- **Retry reserve:** +25%, from the rate card's `retryReservePercent`.
- **Margin:** the owner-approved 65%.
- **Credit value:** $0.00216 per credit, the cheapest pack's rate (the same basis as Voice Studio pricing).

## Proposal

| Option | Cost per minute | Price per minute | Credits per minute | 8-minute video |
| --- | --- | --- | --- | --- |
| **A. Standard long video** (Flux images) | $0.38 | $1.08 | **500** | 4,000 credits |
| **B. Long video with a fixed character** (Gemini images with a reference) | $0.86 | $2.45 | **1,150** | 9,200 credits |
| For comparison: today's approved retail | — | $3.56 | 1,648 | 13,200 credits |

### Notes

- **Option A** is cheaper than today's retail and keeps a 65% margin. Most of the cost is the render and platform estimate, which has not been measured yet; re-check it after 2 weeks of real use.
- **Option B** is the only way the fixed character works. The current image provider (Cloudflare Flux) ignores the reference image.
  - Option B needs a Gemini image provider registered in the factory and its price verified.
  - Choosing the provider per project (Flux for A, Gemini for B) is a small backend change that is not built yet.

## Applying it after approval

This is admin configuration, not code:

1. In `videoFactoryPolicy`, set `packageRequired: false` so videos are paid from the credit wallet. The current package holders keep their package credits.
2. Keep `commercial.mode: DURATION_RETAIL`, set `saleCents` to 108 per 60 s (option A), and set `creditRate` so 1 credit = 0.216 US cents.
3. The quote then charges the per-minute price in credits. The existing guards (`ACTION_BUDGET_EXCEEDS_RETAIL`, the daily cap and the budget cap) stay in force.

## Option B, fixed character (code ready 2026-11-14, price waiting for the owner)

The code is live-ready but inert. A project uses the character provider only when all three are set:
- the project has a character image;
- `videoFactoryPolicy.characterImageProvider` is set;
- `videoFactoryPolicy.characterSaleCents` is set.

### Cost per minute

The provider is `vf-google-nano-banana` (`gemini-3.1-flash-image`). The rate card puts it at $0.067 per image, verified 2026-10-19.

| Item | Cost per minute |
| --- | --- |
| Script | $0.033 |
| 10 images | $0.67 |
| Narration | $0.064 |
| Render | $0.20 |
| **Total** | **$0.967** |
| With the 25% reserve | $1.21 |

### Proposed price

**`characterSaleCents` 1200, which is 1,200 credits per minute.**
- At the cheapest pack, 1,200 credits are about $3.56, a 66% margin.
- An 8-minute video costs 9,600 credits. That is under `maxProjectCredits` (10,000).
- Videos longer than about 8 minutes would need `maxProjectCredits` raised.

### Applying it after approval

1. Enable `vf-google-nano-banana` with `commercialApproved` and `safetyReviewed` set.
2. Set `characterImageProvider` to "vf-google-nano-banana" and `characterSaleCents` to 1200.
