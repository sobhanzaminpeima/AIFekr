# Follow-up automations (rules)

Every rule:
- starts **off**;
- is evaluated against current data when it is planned and again right before it is sent;
- fires at most once per user per period (`Period` column; "once" = once ever).

Kinds:
- **Guidance** rules help the user succeed.
- **Promotional** rules talk about plans and never reach a paying customer.

Texts are in fa/en (editable in admin) plus built-in de/tr (`src/lib/growth/templates-intl.ts`).

Variables: `first_name`, `preferred_module`, `current_plan`, `credit_balance`, `recommended_next_step`, `pricing_url`. An unknown variable fails validation on save, and fails the job if it ever reaches the engine.

| Priority | Rule | Kind | Eligible when (re-checked before send) | Link | Period |
|---|---|---|---|---|---|
| 1 | `payment_failed` | guidance | Failed payment in the last 3 days, plan not active | /payments | per failure day |
| 2 | `post_purchase` | guidance | Paying, first paid ≤ 3 days ago | module page | once |
| 3 | `renewal_soon` | guidance | Paying, plan ends within `renewalSoonDays` | /plans | per expiry date |
| 4 | `welcome` | guidance | Day 0, no first result | intended module | once |
| 5 | `voice_first_generation` | guidance | Came for Voice Studio, day 1–6, no audio | /voice-studio | once |
| 6 | `live_first_session` | guidance | Came via the Live campaign, day 1–6, no live call ≥ 30 s; also needs `live_campaign_enabled` | /live | once |
| 7 | `getting_started_24h` | guidance | Day 1–2, no first result | intended module | once |
| 8 | `second_workflow_day3` | guidance | Day 3+, has a first result, < 2 active days, not paying | intended module | once |
| 9 | `inactive_return` | guidance | Had results, inactive ≥ `inactiveDays` | first used module | per 30 days |
| 10 | `low_credit_day7` | promotional | Day 7+, free, has a result, credits ≤ `lowCredits` | /pricing | once |
| 11 | `paid_benefits_day5` | promotional | Day 5+, free, segment `engaged_free` | /pricing | once |
| 12 | `demo_offer_day10` | promotional | Day 10+, free, score ≥ `highIntentScore` | /contact | once |
| 13 | `feedback_day14` | guidance | Day 14–29, not paying | /contact | once |

## Suppression reasons (job log)
| Reason | Meaning |
|---|---|
| `unsubscribed` | The user used the unsubscribe link or turned messages off. |
| `suppressed_all` | An admin, a bounce or the system suppressed every channel. |
| `no_longer_eligible` | The data changed between plan and send (for example, the user got their first result). |
| `paid_customer` | A promotional rule would have reached a paying customer. |
| `already_sent` | This key was already sent. |
| `expired` | The job could not be sent within `expireHours`. |
| `no_channel` | No allowed channel remains. |
| `user_unavailable` | The user was deleted or blocked, or is not a customer. |

## Deferral reasons (job stays queued)
| Reason | Meaning |
|---|---|
| `quiet_hours` | Tehran quiet hours. |
| `frequency_cap_per24h`, `frequency_cap_per7d` | The user reached a frequency cap. |
| `retry` | Delivery failed; the job waits for its backoff. |

## Cancellation (`cancelled`)
| Reason | Meaning |
|---|---|
| `engine_disabled`, `dry_run_mode`, `lifecycle_automation_disabled`, `communications_disabled`, `no_channel_enabled`, `rule_disabled`, `live_campaign_disabled` | A live job's switch was turned off before it was sent. |
| `admin_cancelled` | An admin cancelled it. |
| `unknown_rule` | The rule no longer exists. |

## Adding a rule
1. Add it to `RULES` in `src/lib/growth/automation.ts` with fa/en texts and an `eligible` predicate over `CustomerFacts` (authoritative data only, never transcripts or prompts).
2. Add de/tr texts to `INTL_TEMPLATES`.
3. Place it in `RULE_PRIORITY` (`src/lib/followup/engine.ts`).
4. Add a test.

It is off until an admin enables it.
