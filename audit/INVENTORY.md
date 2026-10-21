# AIFekr — Module & Stack Inventory
_Audit date: 2026-10-21 | Branch: codex/design-foundation_

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5 |
| ORM | Prisma 5.22 (SQLite dev / PostgreSQL prod via adapter) |
| Auth | Custom JWT (bcryptjs) + Google OAuth |
| Payments | ZarinPal v4 REST API |
| AI Providers | Anthropic Claude, OpenAI, Fal.ai, Replicate, DashScope (Qwen), headroom-ai |
| Storage | AWS S3 / Cloudflare R2 |
| Email | Nodemailer / Resend |
| Queue/Cron | HTTP cron endpoints (4 routes), Redis via ioredis/Upstash |
| Testing | Vitest (config present, no test files found) |
| i18n | Custom locale routing (/fa, /en, /de) |
| State | TanStack Query |

## Modules Found in Repository

| Module | Routes | Status | Notes |
|---|---|---|---|
| Dashboard / Home | `/` | ✅ Active | Chat, image, video, music generation |
| Chat | `/chat`, `/api/chat` | ✅ Active | Multi-provider AI chat |
| Image Generation | `/image/generate`, `/api/image` | ✅ Active | Multiple providers |
| Video Generation | `/video/generate`, `/api/video` | ✅ Active | Multiple providers |
| Music Generation | `/music/generate`, `/api/music` | ✅ Active | |
| Plans & Billing | `/plans`, `/api/payment` | ✅ Active | ZarinPal gateway |
| CRM | `/(business)/crm`, `/api/crm` | ✅ Active | Full v3 with roles, pipeline, invoices |
| SEO | `/(business)/seo`, `/api/seo` | ✅ Active | GSC integration, content calendar |
| Social Media | `/(business)/social`, `/api/social` | ✅ Active | Instagram automation |
| Business Doctor | `/(business)/business-doctor` | ✅ Active | AI analysis |
| CEO Orchestrator | `/(business)/ceo` | ✅ Active | Boardroom, cron auto-run |
| Website Designer | `/(business)/website-designer` | ✅ Active | AI site generator |
| Voice Agent | `/(business)/voice-agent`, `/api/voice-agent` | ✅ Active | VAPI integration, add-on plan |
| Admin Panel | `/admin/*` | ✅ Active | ~20 sections |
| Startup | `/(dashboard)/startup` | ✅ Active | Startup project generator |
| Gallery | `/(dashboard)/gallery` | ✅ Active | Media library |
| Industry Packs | `/(dashboard)/industry` | ✅ Active | |
| Team | `/api/team` | ✅ Active | Team plan with seats |
| Referral | `/(dashboard)/referral` | ✅ Active | Referral credits |
| AI Assistants | `/(dashboard)/assistants` | ✅ Active | Role-specific assistants |

## Modules NOT FOUND (from Audit Spec)

| Module | Status |
|---|---|
| Student / Study Companion | **NOT FOUND** |
| Fitness / Coach-Trainee | **NOT FOUND** |
| Real Estate (dedicated module) | **NOT FOUND** (voice agent covers RE calling only) |
| Games / Play (`/play`) | **NOT FOUND** |
| Accounting | **NOT FOUND** |
| Daily Rental / Property Management | **NOT FOUND** |
| Lead Generation (standalone) | **NOT FOUND** |
| AI Voice Call Center (separate from Voice Agent) | Partially (Voice Agent = RE calling) |
| Marketing Automation | **NOT FOUND** |

## Database Models (Prisma Schema — 1369 lines)

Core: User, Team, TeamMember, Package, Payment, UsageLog, OtpCode, SiteSetting  
CRM: CrmContact, CrmDeal, CrmPipeline, CrmActivity, CrmTask, CrmDocument, CrmNote, CrmProduct, CrmInvoice, CrmContract, CrmProject, CrmAutomationRule  
Content: Conversation, GeneratedImage, GeneratedVideo, GeneratedMusic, SocialPost, ScheduledPost, ContentPost, ContentPipelineRun  
SEO: SeoConnection, GscConnection  
Social: InstagramConnection  
Business: BusinessAnalysis, BusinessMemory, Company, GeneratedWebsite  
Voice: VoiceAgent, VoiceProperty, VoiceCallLog, VoiceAppointment, VoiceKnowledgeBase  
Other: StartupProject, CeoTask, BoardroomSession, IndustryPack, Project

## CI / Deployment

- Production: `https://aifekr.com` (server: 194.59.171.82)
- Deploy script: `scripts/deploy.sh` (rsync + PM2)
- No CI/CD pipeline found (no `.github/workflows`)
- Tests: Vitest configured but **0 test files found**
