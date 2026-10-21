# Student Academy: repository audit and implementation plan

## 1. Existing architecture
The repository is a Next.js 14 App Router application, React 18, TypeScript and Tailwind. Next route handlers are the backend. Prisma 5 manages an existing SQLite database and checked-in migrations. Cookie JWT authentication resolves live User records; requireAdmin checks ADMIN/SUPER_ADMIN and subscription expiry. Student access additionally checks the existing Student entitlement/module gate.

## 2. Existing components
StudentWorkspace already contains private course uploads, notes, flashcards, quizzes, exams, planner/tasks, timed study sessions, groups, tutor, thesis and assignment tools. StudentCourse is personal study material, not the shared academy catalog. The recently implemented AiCourse catalog, AiCourseGenerationJob and AiCourseProgress provide draft generation, guarded credit reservations/refunds and basic lesson quizzes. AdminCourses and LearnCourses are the shared course interfaces. Student profile currently supports branding/public sharing, not normalized academic records.

## 3. Database impact
Extend AiCourse rather than replace it. Add normalized majors/specializations and an academic profile, many-to-many major targeting, immutable published version snapshots, permanent assessment attempts, completion/certificate records, and learning paths. Keep AiCourseProgress as the enrollment/progress record. Snapshot legacy published versions before changes; retain historical progress and certificate IDs. Do not reset existing data or delete personal StudentCourse tables.

## 4. Routes/pages
Reuse /student, /learn, /admin/ai-courses and Admin Users. Add academy major/certificate/analytics administration and public /verify-certificate/[code]. Course player loads the current lesson rather than all lesson bodies. Student academic onboarding and achievements live inside the existing workspace/profile.

## 5. APIs
Reuse /api/learn/courses and /api/admin/ai-courses. Add academic-profile/major endpoints, enrollment and current-lesson reads, permanent assessments, version-bound completion, verification/revocation, and learning paths. All student reads remain scoped to the authenticated student; public verification returns only certificate presentation fields.

## 6. Admin impact
Existing Admin Credit Rules remain authoritative (AI_COURSE_GENERATION default 100). Admin manages major targeting, structured blocks, completion rules, blueprint approval, publication, versions, learner attempts and revocations. No casual complete-course override. Existing AuditLog records privileged changes and certificate lifecycle.

## 7. Reusable services
Reuse routedStreamChat/provider fallback; User/Team wallets and UsageLog; studentWorkspaceDisabledResponse; JWT/RBAC; R2/upload conventions; publicAppUrl; existing React PDF renderer and QR dependency; LangProvider/tri (fa/en/de/tr); notification creation and email service; analytics track endpoint; existing cron authorization. Existing study quizzes are tied to private StudentCourse, so academy assessments need version-scoped attempts while reusing deterministic answer validation patterns.

## 8. Migration plan
Generate a forward-only Prisma SQL migration; inspect every statement. Add tables/columns/indexes, copy current published content into immutable versions, and bind existing progress to its matching version where possible. Ambiguous legacy progress must be flagged, never marked verified. Test on isolated SQLite before consistent production backup and migration deployment. Retain rollback release and database backup.

## 9. Security risks
IDOR, answer-key leakage, forged completion, quiz replay/races, mutable published requirements, certificate forgery, unsafe generated blocks/media URLs, provider prompt injection and duplicate credit charges. Mitigate with server gates, strict schemas, text-only safe rendering, immutable version references, transactional attempts/completion, unique issuance, random verification tokens, scoped certificates, audited revocation and existing durable credit reservation locks. No email/private user IDs on public verification. Do not claim institutional accreditation.

## 10. Implementation plan
A: normalized academics and relevance. B: immutable publication/enrollment snapshots. C: approved blueprint and structured blocks integrated into existing generation/reservations. D: responsive discovery/player/tutor and server progress. E: persistent assessments and configurable completion validator. F: English PDF/QR verification/revocation. G: student/admin profile integration. H: managed paths, real analytics, accessibility/performance and security regression tests.

## Infrastructure findings
R2 is the object storage service; upload routes also have established local-file handling. @react-pdf/renderer and qrcode are installed; current academy certificate is SVG and lacks public verification. Email uses Resend/Nodemailer-related infrastructure and durable payment notifications; Notification already exists. Analytics has an authenticated event endpoint. Background work currently uses persisted jobs plus authenticated cron/watchdogs, not an existing general queue worker. Existing AI course generation is staged but its outline is not yet reviewed separately. Current lesson bodies are strings and course reads transfer all content. The new work must fix these gaps without bypassing the existing 100-credit transaction.

Implementation status and limitations will be updated after each validated phase. This audit describes actual repository capabilities, not completed new features.
