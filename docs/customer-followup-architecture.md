# Smart follow-up & conversion engine: architecture

It follows up with AIFekr's own customers only. The tenant CRM (our users' own leads) is separate and is never read here.

```
 Instagram comment «لایو» ─▶ existing comment→DM automation (webhooks/instagram)
                                   │ DM link: /api/social/instagram/campaigns/link?c&l
                                   ▼
  recordLinkTouch (server, own host + UTM only) ──▶ GrowthTouch + anon cookie ──▶ redirect /live?utm_…
                                                                                    │ (signed out → /login?redirect=/live…)
  sign-up ─▶ linkSignup: touches → user, GrowthProfile.intendedModule = "live"       ▼
                                                                    AIFekr Live (LiveVoiceSession: seconds, minutes)

  authoritative data: User, Payment, CreditLedgerEntry/User.credits, UsageLog, GrowthEvent,
                      artifact tables, LiveVoiceSession  ──▶ growth/facts.ts (loadFacts) ──▶ lifecycle.ts
                                                            (stage, segments, explainable score)

  hourly cron POST /api/cron/growth-lifecycle ──▶ followup/engine.ts runFollowupCycle
        planFollowups  ── one FollowupJob per (rule, user, period), ≤1 open job per user
        processFollowups ── claim → re-check → defer / suppress / holdout / dry_run / send
                                   └─ channels.ts adapters (in-app + optional push, email via Resend)
                                   └─ GrowthMessage (sent log, shared idempotency key)
  admin /admin/customer-growth  ──▶ /api/admin/growth (existing) + /api/admin/followup (new)
```

## Single sources of truth
- **Plan and subscription:** `User.plan`, `User.planExpiry` and `Payment` (status `SUCCESS`). Nothing is cached in a shadow table.
- **Credits:** `User.credits`, maintained with `CreditLedgerEntry` (`src/lib/credits/ledger.ts`) as the only ledger. The engine never grants or moves credits.
- **Usage and first value:** artifact rows and `UsageLog` (`facts.ts`). AIFekr Live counts only from `LiveVoiceSession` (≥30 s, or one charged/free minute).
- **Live transcripts** (`Conversation.tool="live"`) are excluded from every targeting query.
- **Sent messages:** `GrowthMessage` (`status="sent"`). The engine writes it in the same transaction as the in-app notification, and it feeds the frequency caps.

## New tables (migration `20261105120000_followup_engine`, additive)
- **`FollowupJob`**: the queue.
  - `idempotencyKey` is unique: `rule:user[:period]` for live jobs, `dry:` + key for dry runs, so a dry run never uses up a live send.
  - Other columns: `status`, `mode`, `channel`, `variant` (holdout arm), `attempts`/`maxAttempts`, `nextAttemptAt`, `lastError` (addresses redacted), and `notificationId`.
- **`FollowupSuppression`**: user × channel (`all` | `in_app` | `email` | `push`). Admin suppressions can be lifted; lifting one never grants consent.

## Job lifecycle
`queued` → `processing` (atomic claim) → one of:
- `sent`
- `dry_run`
- `holdout`
- `suppressed` (with a reason)
- `failed`
- `cancelled`
- back to `queued`, deferred because of quiet hours, a cap or a retry.

Checks run in this order on every attempt:
1. Expired (`expireHours`, default 72).
2. Unknown rule.
3. Live blockers. A live job is cancelled the moment any switch is off.
4. User exists, is not blocked and has role USER.
5. Unsubscribed (`GrowthProfile.unsubscribedAt`) or suppressed for `all`.
6. The rule is still eligible on current data.
7. A promotional rule targeting a paying customer is suppressed.
8. Not already sent (a `GrowthMessage` exists for the key).
9. Tehran quiet hours: deferred until the window ends.
10. Caps: 1 per 24 h and 3 per 7 days by default, counted over real sends. Deferred until the cap frees.
11. Channel:
    - email needs the email channel on, an address, explicit marketing consent and a configured `RESEND_API_KEY`;
    - otherwise in-app;
    - otherwise suppressed.
12. The template renders (an unknown variable fails the job).
13. Holdout arm → `holdout`.
14. Dry run → `dry_run`.
15. Send.

Retry: exponential backoff (15, 30, 60… minutes, capped at 12 h) up to `maxAttempts` (default 4), then `failed`.

At-most-once for email:
- If the email left but recording it failed, the job is marked `sent` (`recorded_after_error`).
- A stale email claim is failed (`interrupted`), never re-sent.

In-app sends are one transaction, so a crashed claim retries safely.

## Gates (all off by default)
| Gate | Where | Default |
|---|---|---|
| Engine on/off | `followupSettings.engine_enabled` | off |
| Mode | `followupSettings.mode` | `dry_run` |
| Channels in-app / email / push | `followupSettings.channels` | all off |
| Growth flags | `growthSettings.flags.lifecycle_automation_enabled`, `automated_communications_enabled` | off |
| Rule | `growthSettings.messaging.enabledRules` | none |
| Live campaign rule and card | `followupSettings.live_campaign_enabled` | off |
| Push transport | env `MOBILE_API_ENABLED` + `MOBILE_PUSH_ENABLED` | server-dependent |
| Email transport | env `RESEND_API_KEY` | server-dependent |

Turning on the live mode, any channel or the Live campaign needs the SUPER_ADMIN role and is written to `AuditLog` (`followup_settings_updated`).

## Lead scoring
`lifecycle.ts` `scoreFor` scores 0–100 from fixed rules. Each rule counts once per window, and each point comes with its evidence. The weights are admin-tunable hypotheses. The new `liveUsed` weight defaults to 0. Segments and stages are unchanged and documented in `docs/customer-growth/analytics-definitions.md`.

## Experimentation
The per-rule holdout is deterministic: `sha256(rule:user) % 100 < holdoutPercent`, 0 by default. Holdout users go through every check and are recorded, but are never messaged.

Lift is reported only when both arms have at least 30 users. It is a difference in conversion rate (points), with no significance claim.

## Rule priority
In order: `payment_failed`, `post_purchase`, `renewal_soon`, `welcome`, `voice_first_generation`, `live_first_session`, `getting_started_24h`, `second_workflow_day3`, `inactive_return`, `low_credit_day7`, `paid_benefits_day5`, `demo_offer_day10`, `feedback_day14`. A user has at most one open job at a time.
