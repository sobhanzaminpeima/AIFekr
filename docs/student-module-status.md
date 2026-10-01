# AIFekr Student module

## Current scope

The integrated Student release provides `/student` with user-owned course spaces (including editable course metadata), PDF/DOCX/text material import, notes, exam dates, assignments/deadlines, editable study sessions, a seven-day deadline-based study-plan proposal, course-grounded AI Q&A, a learning-focused assignment helper (brief breakdown, outline, draft feedback, and Socratic hints), manual/generated flashcards with persisted spaced-review scheduling, multiple-choice quizzes, and persisted quiz attempts. AI actions use the existing provider router and shared credit charging. Study-plan suggestions are a transparent heuristic derived from recorded exam dates, not an AI prediction. Uploads are size/type checked and parsed in-process; there is no claim of OCR, audio transcription, or background processing.

Study sessions can be started from the student workspace and controlled from a persistent dashboard timer dock, so navigation to another dashboard page does not discard an active timer. Pausing and resuming are recorded as timestamped events and included in study reports; elapsed study time excludes pauses. A study group may optionally be linked to a course owned by the student, with the course choice left optional. Planner date inputs use the browser's locale-aware date control to avoid the prior hard-coded US date format.

The student workspace has mobile-specific spacing and action layout, horizontally navigable section tabs, and safe-area spacing for the dashboard's bottom navigation. On mobile, pulling down at the top of a dashboard page refreshes its server-rendered data. The active study timer dock is fixed above the bottom navigation. Account settings show email/profile identifiers in a single-column layout on narrow screens and safely wrap long LTR email addresses. The expired-trial banner rechecks the authenticated account entitlement after navigation, browser focus, and tab visibility changes so admin-updated plans do not leave stale trial messaging on an already-open dashboard. `/api/auth/me` returns no-store headers for this reason.

Student is exposed from the public landing page and industry marketplace, the signed-in sidebar, onboarding, Home, and `/admin/student`. Onboarding can route a student to the Student workspace. Business navigation is kept separate until the account has an active CRM entitlement or an existing industry pack. The Student workspace offers configured CRM add-ons and the existing monthly/quarterly/semiannual/annual billing flow; selecting an industry then uses the existing CRM-gated activation endpoint.

The admin page reports aggregate usage and can disable the feature globally. Student API routes enforce that switch and scope course data to the signed-in user. UI text is localized in Persian, English, German, and Turkish.

## Database

The additive migrations are `prisma/migrations/20260930_student_workspace/migration.sql`, `prisma/migrations/20260930_student_workspace_01_tasks/migration.sql`, `prisma/migrations/20260930_student_workspace_02_course_details/migration.sql`, `prisma/migrations/20260930_student_workspace_03_flashcard_review/migration.sql`, and `prisma/migrations/20261003_student_timer_pauses_and_group_course/migration.sql` (in dependency order); Prisma models are in `prisma/schema.prisma`. The repository schema and local example use SQLite. The developer database has historical migrations pending and does not yet contain the Student tables, so do not run `prisma migrate deploy` against it: that would attempt the entire historical migration chain. Production migration status must be checked against the actual production `DATABASE_URL`, backed up, and then migrated through the deployment process.

## Deliberately not represented as complete

This release does not yet provide lecture recording/transcription, a source-search/research library or citation manager, calendar reminders, mock exams with timers/autosave, collaboration, PPTX/image OCR, or a secure code sandbox. The current study-plan proposal is rule-based and the student task list is not yet a full calendar. Those need further product/API/schema work and any provider/storage configuration they require. There is no fake-success UI for these capabilities.

## Verification

At the student timer/group checkpoint: targeted study-session and group API tests passed (7 tests); `npx tsc --noEmit` passed; Prisma schema validation and client generation passed; and the production build completed. The build emitted an existing Recharts export warning in the admin dashboard and an Edge-runtime static-generation warning. Production migration and health checks were completed during deployment; live payment/provider checks are not covered by these checks.
