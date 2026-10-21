# AIFekr Student Academy

## Architecture
See `student-academy-architecture.md` for the repository audit performed before implementation. This feature extends the existing StudentWorkspace, AiCourse catalog, AdminCourses, cookie JWT permissions, routed AI providers, User/Team credit wallets, UsageLog, AuditLog, storage and localization. Personal uploaded StudentCourse material, planner, flashcards, groups and study tools remain independent existing workspace features.

Published course versions contain immutable structured JSON. An active publication pointer permits draft editing without replacing the version students see. Enrollments reference the exact version they started. The catalog returns metadata; the player requests one lesson at a time. Content is rendered as safe React text/components, never generated raw HTML. Approved course content provides context for the existing AI tutor.

## Database and migrations
Three additive Prisma migrations extend the existing tables:

- `20261005150000_student_academy`: majors, specializations, academic profiles, major mappings, immutable versions, assessment attempts, verified completions, certificates and paths; extends existing progress and generation jobs.
- `20261005180000_academy_notes_revisions`: account-bound lesson notes, draft revisions, verification counters.
- `20261005200000_academy_publication`: publication pointer and immutable version discovery metadata.

No reset, table deletion or student-data replacement. Legacy published versions are snapshotted; matching enrollments remain bound. Historical completions retain a `LEGACY_COMPLETED` state and their original certificate download. They do not become newly verified certificates without passing the new server validator. Ambiguous historical versions are never silently certified.

Before deployment: create a consistent SQLite backup using `scripts/backup-deployment-db.cjs`, preserve the previous release, then apply pending migrations with the repository's Prisma deployment/baselining procedure and run `npx prisma generate`. For a database already managed by migrations, use `npx prisma migrate deploy`. Never use `db push --force-reset` or `migrate reset` in production. Tests use only `file:./vitest.db`; local browser QA uses a separate preview database.

## Routes and APIs

| Surface | Purpose |
| --- | --- |
| `/student`, `/learn` | Existing student workspace, academy overview, catalog, player and academic profile |
| `/admin/academy` | Majors, specializations, learner activity, assessments, certificates, analytics and paths |
| `/admin/ai-courses` | Existing course editor and AI generation, extended with academy settings |
| `/admin/users/[id]` | Academic profile, real enrollment/assessment/certificate history |
| `/verify-certificate/[code]` | Public ACTIVE / REVOKED / NOT FOUND verification |
| `/api/student/academic-profile` | Own normalized academic data and achievements |
| `/api/learn/courses/[id]/enroll` | Enrollment in an active published version; optional learning-path prerequisites |
| `/api/learn/courses/[id]/lesson` | One lesson, public questions and signed bank selection |
| `/api/learn/courses/[id]/progress` | Start, deterministic assessment submission, verified lesson completion |
| `/api/learn/courses/[id]/notes` | Private, persistent notes for an enrolled version and lesson |
| `/api/learn/courses/[id]/tutor` | Existing paid AI tutor grounded in the approved version |
| `/api/learn/courses/[id]/certificate` | Authoritative English PDF, scoped to student or authorized admin |
| `/api/admin/academy/*` | Privileged major/path/media/certificate administration |
| `/api/admin/ai-courses/[id]/blueprint` | Approve edited blueprint or cancel/refund |
| `/api/admin/ai-courses/[id]/regenerate` | Paid fragment preview and free explicit application |
| `/api/admin/ai-courses/[id]/revisions` | Inspect history and restore as a new review-required draft |
| `/api/cron/course-generation` | Existing authenticated worker and expired-reservation reconciliation |

## Generation and credits
`AI_COURSE_GENERATION` defaults to **100** in the existing Admin Credit Rules. The button shows current cost/balance before confirmation. Server-side reservations use the existing payer wallet and UsageLog; insufficient balance stops before generation. Idempotency keys and conditional job locks prevent duplicate charges. Failure, cancellation or expiry refunds the original wallet once. Generation never publishes a course.

Flow: queued blueprint → validated blueprint → admin review/approval → queued content → structured lessons/checkpoints → assessment generation → schema/size/duplicate validation → review required → explicit publication. Content jobs generate up to four lessons per invocation, two at a time, with a 180-second deadline; subsequent invocations continue saved work under the same reservation. Approval expires after 24 hours. Failed approved-content jobs may resume valid checkpoints only if the source fingerprint still matches. Every provider request includes its explicit JSON Schema. Malformed structured AI responses receive one safe corrective repair of the rejected draft before failure/refund. Flashcards/steps use string arrays, never ambiguous object maps.

Full regeneration is another explicitly confirmed configurable 100-credit action. Description, chapter, lesson, quiz, examples, summary and flashcards use separately configurable `student.academy-*` keys in the existing tool-cost architecture, defaulting to the existing two-credit tool cost. Manual editing, applying a preview, enrollment, normal quizzes, progress, completion and existing certificate downloads do not charge credits. Tutor use remains a separate existing AI action with its displayed configured cost.

The cron/watchdog must permit a complete content chunk: HTTP timeout at least 240 seconds, run every minute, with the existing `CRON_SECRET`. Concurrent runs are fenced by the job lease. No second queue or wallet has been introduced.

## Administration
Administrators manage normalized majors/specializations, multi-major course targeting, difficulty, duration, objectives, audience, teaching style, prerequisites, skills, cover/media and completion requirements. Blueprint and structured lesson editors allow review without regeneration. Existing quiz editing remains available; advanced question banks can be edited in structured JSON. Draft history restoration creates a new version rather than rewriting a published one. Images are decoded, bounded, stripped/re-encoded to WebP and stored using existing R2/local upload conventions.

The academy displays actual enrollment, immutable version, progress, assessment score/answers, verified completion and certificate records. Certificates support search, date/status filters, reasoned revocation and audited PDF reissue that preserves the original certificate identity. A revoked certificate is never reactivated by reissue. There is no bypass-completion button.

## Completion and certificate security
Completion requires authoritative enrollment, the required proportion of lessons, passing permanent lesson/module assessment attempts, and the configured final assessment score. Default new-course settings: all lessons, all lesson assessments at 70%, final assessment at 75%. Existing courses preserve their historical 60%/no-final rules. The backend creates completion and certificate records transactionally and uniquely. Client-supplied progress/completion fields are rejected.

Question banks support multiple choice, multiple selection, true/false, deterministic short answers, ordering and matching. Randomized/subset selection is scoped by signed, expiring user/version/lesson tokens. Correct answers are omitted from pre-attempt payloads. Answer records and selection indices are retained; request-key replay is idempotent. Attempt limits and passing thresholds are server-side.

English PDF certificates derive all fields from the verified completion snapshot. They contain a unique ID, issue date, exact course version and QR to the canonical verification URL. The bundled SIL-licensed Vazirmatn TTF allows non-Latin student names. Public verification reveals name/course/date/issuer/status, never email or private user identifiers. Revocations remain auditable and historical versions are retained. This is an AIFekr completion certificate, not a claim of university accreditation.

## Localization and onboarding
Academy interface copy supports Persian, English, German and Turkish using existing `tri`/LangProvider conventions. RTL applies to Persian interface/content separately. Course content has its own explicitly displayed language; changing interface language does **not** translate approved educational material or alter historical requirements. Certificates remain English by design; the public verification interface is localized. The admin navigation and difficulty labels support all four languages. A dedicated post-registration language step stores User.language and the language cookie before continuing the existing onboarding while preserving package/period intent. Language can still be changed in settings. The shared language picker portals into the nearest modal dialog on mobile, so native dialog inertness cannot block its options; it reads the authoritative language cookie before stale local storage.

## Environment and deployment
Uses existing `DATABASE_URL`, `JWT_SECRET`, routed AI-provider configuration, `CRON_SECRET`, canonical `NEXT_PUBLIC_APP_URL`/public URL settings, and existing R2 configuration. No additional secrets are required. Canonical production URL must be HTTPS and must not be localhost; PDF QR/email links use the existing publicAppUrl helper. React PDF is externalized in Next's server build to preserve font decoding. Include `public/fonts/Vazirmatn-Regular.ttf` and its license in the release.

Do not transfer preview databases, test users/courses, `.env.local`, local PDFs, audit screenshots or temporary archive files into Git/source release bundles. Preserve shared uploads and database location when switching releases. After deployment verify unauthenticated API gates, public verification states, cron authentication, PM2 health and the real published/learner journey.

## Validation
Integration tests cover credit affordability/configuration/refund/idempotency/original team wallet; blueprint approval/checkpoint resume/bounded jobs; draft publication/version preservation; IDOR/admin guards; schema and unsafe media rejection; signed advanced banks; real passing/completion rules; certificate PDF/verification/revocation/reissue; learning-path prerequisites; private notes and audited free revision restore. Unit tests cover each supported assessment type and token tampering/expiry.

Local browser QA used real AI generation and a separate student: normalized major → recommendation → enrollment → failed quiz blocked completion → successful retake and remaining lessons → final assessment → authoritative 100% completion → English PDF with Persian name → public verification. Mobile was inspected at 390×844; private notes persisted after reload. The initial provider-output failure refunded all 100 credits before a successful reviewed generation. PDFs were rendered and visually inspected.

## Practical limits and unfinished enhancements
Human educational review remains essential: schema validation cannot prove factual correctness, and browser QA found an ambiguous generated question that needs editorial correction before publication. There is no automatic translation of published course content. Creating separately reviewed translated course editions is supported; a linked translation-edition switcher is not implemented.

Coding exercises are practice content, not sandbox-executed graded assessments. Short-answer grading uses reviewed accepted answers, not arbitrary AI scoring. Complex learning paths and advanced assessment banks retain a JSON editor; ordinary metadata, blueprint and lesson blocks have graphical editors. A separate secondary-major student selector, specialization-specific recommendation weighting, duration/course-type facets, reusable cross-course question banks, and automatic learning-task/streak derivation are not implemented. Major targeting and manually ordered paths are functional.

Provider/model IDs are tracked where returned by the existing router. Exact token billing is unavailable through its current abstraction and is not fabricated. Expensive automatic image/video creation is intentionally absent; reviewed uploaded media and allowlisted video embeds work. Content is version-bound structured JSON in existing AiCourse conventions, rather than dozens of duplicate content tables. This preserves the current architecture while supporting safe publication and authoritative learning.

## Release validation — 2026-10-05
The complete repository suite, with bank/integration mode enabled against the isolated test database, passed 878 tests; 19 unrelated guarded tests remained skipped. Academy-specific suites passed all 51 tests. TypeScript, targeted ESLint and the production build passed. HTTPS smoke checks returned the expected 200/401/403 statuses and PM2 remained online without restarts. Existing production data and balances were preserved by additive migrations. Six pre-existing orphan references in UsageLog/BusinessAnalysis were reported and preserved rather than deleting historical data.

The real admin Prompt Engineering course has six chapters, twelve structured Persian lessons, lesson quizzes and a final assessment, with an eight-hour estimate. The first production content attempt refunded 100 credits on malformed provider output; schema-guided repair fixed the problem and the resumed generation consumed 100 credits exactly once. Human review clarified ambiguous questions, made 53 flashcards usable, separated development and final evaluation samples, and strengthened privacy/security caveats. These manual edits incurred no additional credits. The UI supports four languages; this reviewed course edition is Persian.
