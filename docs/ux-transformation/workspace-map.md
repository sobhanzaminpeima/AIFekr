# Workspace Map (`src/lib/navigation/workspaces.ts`)

Only existing routes from `destinations.ts` are used.

| Workspace | Groups → routes | Suggested first step |
|---|---|---|
| Business | Grow: /lead-gen, /social, /seo, /website-designer · Customers: /crm, /sales, /voice-agent · Automate: /agents, /ceo/orchestrator, /accounting/automation · Create: /image/generate, /video-factory, /voice-studio · Analyze: /business-doctor, /accounting, /meeting | /crm |
| Real estate | Properties & clients: /crm, /lead-gen, /industry · Marketing: /social, /video-factory, /image/generate, /voice-studio · Finance: /accounting/owner-statements, /accounting | /crm |
| Creator | Create: /image/generate, /video/generate, /video-factory, /voice-studio, /music/generate · Publish: /social, /seo/agent-pipeline · Library: /image/gallery | /image/generate |
| Student | Study: /student, upload, practice quiz, flashcards, /student/chat · Plan: planner, reports, groups · Learn: /learn, /assistants/teacher, /tools/math | upload notes |
| Fitness | /fitness, /assistants/fitness-coach, /tools/healthy-diet | /fitness |
| General AI | Chat & assistants, create (image/voice/video), everyday tools | /chat |

Suggested workspace (never auto-applied): onboarding objective → workspace (`OBJECTIVE_WORKSPACE`), else STUDENT/FITNESS account type.

Not covered by a workspace but still reachable via "All tools" and search: PLAY, Startup builder, CEO advisor, accounting sub-pages, SEO sites, referral, payments.
