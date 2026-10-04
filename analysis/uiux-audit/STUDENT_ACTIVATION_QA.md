# Existing-account student activation — 2026-10-04

Cause: industry Student Workspace and student package CTAs unconditionally linked to registration, and checkout rejected non-STUDENT accounts without offering an explicit selection on the existing account.

Fix: shared session-aware links take existing accounts to /plans with the student package selected, active paid students to /student, and anonymous visitors to plan-aware registration. Covered industry list/detail, public student offer, landing teaser and shared card page. Account settings now show current industry pack and package/Student Agent links.

Student checkout accepts explicit selectStudentAccount=true and snapshots STUDENT classification on the same buyer. Without that choice, non-student checkout remains denied. Creating the pending order does not change account type or grant access; receipt approval uses the existing activation transaction to classify STUDENT, assign University / School, and enable the Student Agent. Welcome-offer reuse and subscription limits remain in force.

Browser QA with synthetic PERSONAL account: normal login; industry CTA linked to /plans?plan=STUDENT_FIRST_THREE_MONTHS&period=monthly; selecting student account reached checkout, without registration. Database confirmed the pending order belonged to the existing user and snapshotted STUDENT; user remained PERSONAL/FREE until approval. Profile section visible; screenshot student-activation-profile.png. No real payment or receipt submitted.

Also fixed onboarding Skip: it now saves onboardingDone rather than navigating into an endless welcome redirect. Onboarding completion is permitted as account recovery for expired users and grants no feature access.

Validation: full suite 108 files / 780 tests passed; TypeScript and targeted lint passed. No database migration required.

Deployment: source commit 1a95ff3 live in /var/www/aifekr-release-1a95ff3. PM2 ai-platform online with zero restarts; state saved. Live HTTPS landing, industry list, university detail and pricing returned 200; anonymous auth/me 401. Internal preview and transfer archives removed. No production user accounts or payments were edited during QA. GitHub publication remains unavailable because authentication is not configured.
