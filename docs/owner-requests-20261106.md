# Owner requests 2026-11-06: campaign report, mandatory mobile number, SMS list

## 1. Complete campaign report (AI analysis pack)
**Where:** Admin → Customer Follow-up & Conversion → Campaigns → «گزارش کامل کمپین‌ها». You can choose a date range and one campaign or all of them.

**Downloads:** `GET /api/admin/growth?view=campaign-pack&format=…&from=&to=&campaign=` (admin only, audited as `growth_campaign_pack_exported`).

| Format | Content |
|---|---|
| `md` | A brief for an AI analyst: totals, funnel, timing, a section per campaign (modules, credits, follow-ups, daily table, weekly cohorts) and every definition with its denominator. |
| `json` | Everything above, machine-readable (`schemaVersion: 1`). |
| `csv` | One row per campaign with every scalar metric. |
| `csv-daily` | One row per campaign per day. |

**Privacy:** aggregates only (counts, rates, sums, medians). No user id, name, email, phone, anonymous id, prompt, transcript or message text. A test checks this.

**Sources:**
- Revenue: `Payment` rows with status SUCCESS.
- Credits: `CreditLedgerEntry`.
- Activation: `facts.ts` (real results; AIFekr Live only from call length).
- Follow-ups: `FollowupJob`.

**Scope:** users who signed up in the range, grouped by the campaign of their first touch. Visits count touches created in the range.

Code: `src/lib/growth/campaignPack.ts`.

## 2. Mandatory mobile number
**Switch:** SiteSetting `phoneRequirement`, shown in Admin → Settings as «شماره موبایل اجباری». It is **on** by default. Only a super admin can change it, and the change is audited. Switching it off is the instant rollback.

**Registration:** `/api/auth/register` refuses an account without a number (`PHONE_REQUIRED`, in the form's language). Both register forms (classic and new design) mark the field as required.

**Every other account without a number:** Google sign-ups, admin invites and existing accounts are sent by `shellGate` to `/complete-phone?redirect=<page>` before any app page, both in the new design and in the classic theme.
- The page offers the country code plus the local number, the same validation as registration (`registrationPhone`), a uniqueness check, and a sign-out button.
- After saving, the user returns to the page they asked for (onboarding comes next if it isn't finished).
- Admins are exempt.

**API:** `GET/POST /api/account/phone`.
- Rate limit: 10 attempts per 10 minutes.
- It only fills an empty number and never overwrites one.

**Admin invites:** a phone is still optional when the invite is created; the invited user is asked for one at first sign-in.

**OTP sign-up:** already creates the account with the phone.

**Limits:**
- The number is not verified by SMS. Validation and uniqueness only, as requested.
- API-only clients are not gated, because the gate is in the page frame.

## 3. SMS list (super admin)
**Where:** Admin → Customer Follow-up & Conversion → Customers & segments → «فهرست موبایل کاربران برای پیامک».

**Endpoint:** `GET /api/admin/growth?view=phone-export&audience=not_opted_out|consented|all`.
- SUPER_ADMIN only.
- Audited as `growth_phone_export`, with counts only.
- At most 3 exports per hour per admin, counted from the audit log, so the limit holds across restarts.

**Columns:** `name, phone_e164, language, registered_at, lifecycle_stage, plan, last_active, marketing_consent, opted_out, opt_out_source`.

**Default audience:** people who have NOT opted out. "Opted out" means `GrowthProfile.unsubscribedAt` is set, or the user has an `all` follow-up suppression.

The UI notes that promotional SMS in Iran must include an opt-out (e.g. «لغو۱۱») and may go only to people who haven't opted out. Nothing is sent from AIFekr; the owner downloads the file and uses his SMS provider.
