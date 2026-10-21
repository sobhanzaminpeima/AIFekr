# Student journey QA — 2026-10-05

The complete simulated purchase used an isolated local database (`uiux-preview.db`). The receipt clearly says TEST ONLY / NOT A REAL PAYMENT. No fake receipt, test student, or test entitlement was created in production. Email and Telegram sending were disabled in the local test process.

## Executed scenario

| Stage | Result |
| --- | --- |
| Student registration through the browser | Created a new STUDENT account; selected the introductory student package. |
| Package checkout and synthetic receipt upload | Bank-transfer order and receipt persisted, then reviewed and approved through the local admin UI. |
| Entitlement after approval | STUDENT_FIRST_THREE_MONTHS, 90-day expiry, University / School industry, enabled Student Agent. |
| Admin tracking | Paid student classification, expiry, successful payment, receipt link, account events and usage visible. Global setting and active-student count corrected. |
| Course | Created cell-biology course; course edit and deletion verified with disposable API fixtures. Cross-account course/material access denied. |
| Materials | Uploaded and extracted a Persian DOCX; uploaded public sample audio and obtained a real transcript. Both sources persisted and are readable in the course. |
| Tutor | Real source-grounded answers named the correct material; second message and reopening from history retained the course context after the fix. |
| Flashcards | Eight AI cards generated; manual card added; review controls exercised. |
| Quiz | Eight real generated questions answered, score 8/8 persisted. Regression test rejects sparse answer arrays when only the final question is answered. |
| Exam and planner | Exam created and edited in the mobile UI; seven study tasks generated; personal task completed and visible in the completed filter. Disposable exam edit/delete API checks passed. |
| Study timer/report | Start, pause, resume and stop recorded; report contains session and pause. Local-day grouping corrected. |
| Study group | Created group, saved message, invited an existing paid student; membership visible to both accounts. First-message rendering crash fixed. |
| Research assistant | All five modes returned real responses and saved notes: proposal, outline, methodology, literature and review. |
| Assignment assistant | All five modes returned real responses and saved notes: understand, steps, outline, feedback and hint. |
| Profile card | Synthetic photo upload persisted and appeared on the branded 1080×1920 card. Persian and English labels/card text checked. |
| Mobile | Actual 390×844 viewport used; all eight student tabs in the built production app had document width 390px with no horizontal overflow. Course, card and admin screenshots retained locally. |
| Expired subscription | Course API and chat API denied access with HTTP 402 / SUBSCRIPTION_EXPIRED; no credit debit. |

Final primary fixture: one course, two materials, 18 notes, nine flashcards, one quiz/attempt, one exam, eight tasks and one completed study session. Credits reconciled exactly: 1,700 after approval − 206 usage = 1,494 remaining. Additional purchases were not needed for the learning scenario.

## Fixes

- Preserve selected package and period through registration/onboarding; unpaid students who skip onboarding still reach student checkout.
- Separate the global workspace setting from per-account access; count all entitled students rather than only course owners; include OCR/transcription tool usage in module metrics.
- Keep student tutor context and route after the first message and when reopening history; validate course ownership on the chat API and rebuild source context on the server. Use educational starter prompts.
- Make uploaded source text and saved notes readable. Show form errors inside their modal, use correct upload-size labels, and refresh counts after saved learning outputs.
- Prevent incomplete quiz submission and changes after results. Clear old answers/cards when switching courses.
- Avoid generating study sessions in the past; read the submitted exam date reliably; expose exam management directly in Planner & Exams.
- Fix invalid Intl date/time options that crashed group messages; improve group loading and separate interactive controls; use the canonical public URL for group invitation links.
- Reset accumulated output when an AI provider fails over. Treat the student's question as a legitimate request and course excerpts as reference data. Prefer the enabled direct model for research/assignment coaching after poor responses were observed; no source or scientific accuracy guarantee is implied.
- Fix the SQLite account-usage date filter using Prisma date predicates; include all recent charges correctly. Align daily study reports with browser timezone. Delay CSV blob URL cleanup.
- Reject malformed/null student API bodies instead of crashing.

## Validation and boundaries

Full automated suite: **117 files / 827 tests passed**, including bank and voice integration flags. TypeScript passed. Targeted lint has no errors; an existing timer-effect dependency warning remains. Production build passed. Additional local HTTP scenario: **28 checks passed**. All **10 AI coaching modes** passed against real providers in the locally built production app. The 3-per-minute research limit returned 429 on a burst; remaining modes passed after its window expired.

Actual banking settlement, delivery to a real email inbox, microphone recording permission, native social sharing and printed output were not exercised. Audio-file transcription was exercised. Native card/CSV download events were not exposed by the in-app browser, so successful file delivery is not claimed. Receipt approval is a simulation, not verification of a real transfer. Content quality remains subject to model behavior and should be checked against course sources.

Local evidence: `student-journey-quiz.png`, `student-journey-mobile.png`, `student-journey-card-mobile.png`, `student-journey-admin-mobile.png`, `student-journey-admin-account.png`; JSON records for HTTP checks, all AI modes and final account state. These fixtures and screenshots were excluded from the production source bundle.

## Deployment

Code release **ad85cb9** deployed to `/var/www/aifekr-release-ad85cb9` after an isolated loopback preview passed. The existing ai-platform PM2 service now runs that release on port 3000, online with zero restarts; PM2 state saved. Previous release retained for rollback and a consistent SQLite backup retained privately with mode 600 at `/var/www/aifekr-db-before-student-journey-ad85cb9.db`. No migration or production user/payment mutation was required.

Live HTTPS checks: landing, pricing, student registration offer and university industry page returned 200; anonymous student/admin/history APIs returned 401. The new Zarinpal merchant setting was preserved. Direct database verification found zero primary synthetic test-student accounts in production. Internal preview stopped; transfer archives and verification script removed. Separate JARVIS services stayed online.

Source committed locally. GitHub push could not authenticate (`unable to get password from user`), so GitHub publication is **not** claimed.
