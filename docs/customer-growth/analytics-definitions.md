# Analytics Definitions

All metrics exclude `ADMIN`/`SUPER_ADMIN` and blocked accounts. Dates are UTC. Missing data is shown as "N/A", never as 0.

| Metric | Definition |
|---|---|
| Signup cohort | Users whose `User.createdAt` is inside the selected range |
| Tracked visitors | Distinct `anonId` with a `GrowthTouch` in range — campaign or external-referral landings only; direct visits are not tracked |
| Onboarding completion | Cohort users with `onboardingDone` or onboarding state `completed`/`contextual` ÷ cohort size |
| First value | First real output row in an artifact table (see below) |
| Activation rate | Cohort users with first value ÷ cohort size |
| Repeat usage | ≥2 active days in the scoring window, or ≥2 successful outputs |
| Checkout start | User has at least one `Payment` row created (any status) |
| Paid | User has at least one `Payment.status = SUCCESS` |
| Free-to-paid | Paid ÷ cohort size. Shown separately for the *mature* cohort (users older than the scoring window, default 30 days) so young cohorts are not compared with complete ones |
| Revenue | Sum of `Payment.amount` (Toman; Toman equivalent at checkout for foreign currencies) over SUCCESS payments |
| Active user | Last activity (login, ledger entry or event) within `inactiveDays` |
| Paying now | Active plan (`planExpiry` in the future) and ≥1 successful payment. Admin-granted trials are not "paying" |
| At risk | Paying and any of: inactive ≥ `atRiskPaidInactiveDays`; failed payment in 14 days; plan ends within `renewalSoonDays` with <2 active days. Rules of thumb, not a churn model |
| Campaign attribution | The user's **first** touch. `unknown` when no touch was recorded |
| Campaign revenue | All successful payments of users attributed to the campaign |
| CAC | Admin-entered spend ÷ paying attributed users; shown only when both exist |

## First-value evidence per module

| Module | Evidence |
|---|---|
| Voice Studio | `VoiceStudioGeneration` READY (or later DELETED) with stored audio |
| Image | `GeneratedImage` row |
| Video | `GeneratedVideo` with `refunded = false` |
| Music | `GeneratedMusic` with `refunded = false` |
| Video Factory | Non-deleted `VideoFactoryProject` (a project, not an export — see limitations) |
| Chat | Conversation with at least one assistant message |
| CRM | `CrmContact` owned by the user (count only) |
| SEO | `SeoAudit` row |
| Social | `SocialPost` row |
| Website designer | `GeneratedWebsite` row |
| Student | `StudentMaterial` row |
| Fitness | `FitnessProfile` exists |

Failed operations = refund rows (`UsageLog.credits < 0`) in the scoring window.
