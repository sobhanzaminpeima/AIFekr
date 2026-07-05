<div align="center">

<img src="public/logo.svg" alt="AiFekr Logo" width="80" />

# AiFekr — AI Platform

### Chat • Image • Video • Music • Business AI Tools

[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://typescriptlang.org)
[![Prisma](https://img.shields.io/badge/Prisma-5-2D3748?logo=prisma)](https://prisma.io)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38bdf8?logo=tailwindcss)](https://tailwindcss.com)
[![Multi-Provider AI](https://img.shields.io/badge/AI-Multi--Provider_Router-ea580c)](#ai-router)

**[🌐 Live Demo](https://aifekr.com/)**

</div>

---

## Demo Accounts

Live demo is running at **http://185.81.96.229:3000**

### Regular Users

| Name | Email | Password | Plan | Credits |
|------|-------|----------|------|---------|
| Ali Rezaei | `ali@test.com` | `test1234` | Free | 500 |
| Sara Mohammadi | `sara@test.com` | `test1234` | Basic | 1,000 |

### Admin & Super Admin

| Role | Email | Password | Plan |
|------|-------|----------|------|
| Admin | `admin@test.com` | `admin1234` | Pro |
| Super Admin | `super@aifekr.com` | `super1234` | Pro |

> Admin panel is accessible at `/admin` — only ADMIN and SUPER_ADMIN roles can access it.

---

## About

**AiFekr** is a full-featured AI platform that combines ChatGPT-style streaming chat, image/video/music generation, and specialized business AI tools — all with complete Persian (RTL) and English (LTR) bilingual support.

---

## Features

### 🔀 AI Router — automatic provider fallback

The platform never depends on a single AI provider.  
`src/lib/ai/router.ts` tries providers in priority order and falls back
automatically when one errors, rate-limits, or takes >10 s to deliver its
first token.

| Provider | Default priority | Strengths |
|----------|-----------------|-----------|
| Anthropic Claude | 1st | general, creative, business |
| OpenAI GPT | 2nd | code, complex reasoning |
| Google Gemini | 3rd | translation, factual, fast |
| DeepSeek | 4th | math, code |

**How it works**

1. The router detects the prompt *category* (code / math / creative / …) and
   picks the best provider for that category.
2. If that provider fails, the next healthy provider is tried automatically.
3. Every fallback event is written to `ProviderFallbackLog` in the database.
4. The **Admin → Provider Fallback Log** page (`/admin/provider-fallback`)
   shows which providers failed, how often, and what categories triggered it.

**Environment variables**

```bash
AI_PROVIDER_PRIORITY="claude,openai,gemini,deepseek"  # override order
FORCE_PROVIDER_FAILURE="claude"                        # test fallback locally
```

**Testing fallback**

```bash
FORCE_PROVIDER_FAILURE=claude npx ts-node scripts/test-router-fallback.ts
# Expected: router skips claude, succeeds with openai (or next healthy provider)
```

---

### 🤖 AI Chat
- Streaming chat via the multi-provider router (real-time SSE, token-by-token)
- **Voice input** — send messages by speaking (Web Speech API)
- **Voice output** — have AI responses read aloud (TTS)
- Conversation history with automatic titling
- Full Markdown, code blocks, and table rendering

### 🎨 Content Generation
- **Image Generation** — via Fal.ai and Replicate
- **Video Generation** — AI video models
- **Music Generation** — AI-powered music creation

### 🏢 Business AI Tools

| Tool | Description |
|------|-------------|
| 🩺 Business Doctor | SWOT analysis, KPI recommendations, action plans |
| 👔 CEO Advisor | Strategic decision-making with AI |
| 🔍 SEO Workspace | Keyword research, content optimization, meta tag generator |
| 📱 Social Media Agent | Platform-optimized post generation |
| 🌐 Website Designer | Generate a complete website with downloadable HTML |
| 🏭 Industry Packs | Specialized AI agent teams for 8 industry verticals |
| 🎯 AI Meeting Room | Simulate a strategic meeting with multiple AI agents |

### 🌐 Bilingual (FA / EN)
- Full **Persian (RTL)** and **English (LTR)** support
- Page direction switches automatically with language
- All UI labels, prompts, and messages are localized

### 💰 Multi-Currency
- Supports USD, EUR, AED, GBP, IRR
- Automatic price conversion with configurable exchange rates

### 🔐 Authentication
- Email + password registration and login
- Secure JWT cookies
- Plan tiers: Free, Basic, Pro, Team
- Credits system for each AI operation

### ⚙️ Admin Panel
- User management, conversation logs, credit top-ups
- Industry pack management
- Site settings with DB persistence (name, currency, language, email)
- Role-based access: ADMIN, SUPER_ADMIN

---

## Tech Stack

```
Frontend:    Next.js 14 (App Router) + TypeScript + Tailwind CSS
Backend:     Next.js API Routes (Edge + Node.js)
Database:    SQLite (better-sqlite3) via Prisma ORM
AI:          Multi-provider router (Claude / OpenAI GPT / Google Gemini / DeepSeek)
             with automatic fallback — see src/lib/ai/router.ts
Media:       Fal.ai (image/video), Replicate
Auth:        JWT (jsonwebtoken) + bcryptjs
Storage:     AWS S3 / Cloudflare R2
Deployment:  Ubuntu 22.04 + PM2 (port 3003)
```

---

## Quick Start

### Prerequisites
- Node.js 18+
- npm 9+

### Installation

```bash
# Clone the repository
git clone https://github.com/inexpoaiagent/AIFekr.git
cd AIFekr

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Fill in your API keys in .env.local

# Set up the database
npx prisma generate
npx prisma migrate dev
npm run db:seed

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Environment Variables

Create a `.env.local` file with the following:

```env
# Database
DATABASE_URL="file:./prisma/dev.db"

# Auth
JWT_SECRET="your-secret-key-here"

# ── AI Provider Router ─────────────────────────────────────────────────────
# Priority order — the router tries providers left-to-right, falling back
# automatically on error or >10 s first-token timeout (src/lib/ai/router.ts)
AI_PROVIDER_PRIORITY="claude,openai,gemini,deepseek"

# Anthropic Claude (primary)
ANTHROPIC_API_KEY="sk-ant-..."
CLAUDE_MODEL="claude-haiku-4-5-20251001"

# OpenAI GPT (fallback 1)
OPENAI_API_KEY="sk-..."
OPENAI_MODEL="gpt-4o-mini"

# Google Gemini (fallback 2)
GOOGLE_API_KEY="AIza..."
GEMINI_MODEL="gemini-2.0-flash"

# DeepSeek (fallback 3)
DEEPSEEK_API_KEY="sk-..."
DEEPSEEK_MODEL="deepseek-chat"

# Force a provider to be skipped — useful for local fallback testing
# FORCE_PROVIDER_FAILURE="claude"

# Media Generation — Optional
FAL_KEY="..."
REPLICATE_API_TOKEN="r8_..."

# Storage — Optional
AWS_ACCESS_KEY_ID="..."
AWS_SECRET_ACCESS_KEY="..."
AWS_REGION="..."
AWS_BUCKET_NAME="..."

# Email — Optional
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your@email.com"
SMTP_PASS="your-app-password"
```

---

## Project Structure

```
src/
├── app/
│   ├── (dashboard)/          # Protected dashboard pages
│   │   ├── chat/             # AI Chat
│   │   ├── image/            # Image generation
│   │   ├── video/            # Video generation
│   │   ├── music/            # Music generation
│   │   ├── business-doctor/  # Business Doctor
│   │   ├── ceo/              # CEO Advisor
│   │   ├── seo/              # SEO Workspace
│   │   ├── social/           # Social Media Agent
│   │   ├── website-designer/ # Website Designer
│   │   ├── industry/         # Industry Packs
│   │   ├── meeting/          # AI Meeting Room
│   │   └── settings/         # User settings
│   ├── admin/                # Admin panel (ADMIN role required)
│   ├── api/                  # API routes
│   │   ├── auth/             # Login, register, logout
│   │   ├── chat/             # Streaming chat endpoint
│   │   ├── admin/            # Admin APIs
│   │   └── ...
│   ├── login/
│   ├── register/
│   └── page.tsx              # Landing page
├── components/
│   ├── chat/                 # ChatInterface (voice in/out)
│   ├── landing/              # DemoChat animated section
│   ├── layout/               # Sidebar (bilingual)
│   └── ui/                   # LanguageSwitcher, CurrencySelector
├── lib/
│   ├── auth/                 # JWT helpers
│   ├── db/                   # Prisma client
│   ├── i18n/                 # FA/EN translation dictionaries
│   └── currency.ts           # Multi-currency utilities
└── prisma/
    ├── schema.prisma
    └── seed.ts               # Initial data (users, industry packs)
```

---

## Industry Packs

8 purpose-built AI agent teams for specific industries:

| Industry | Agents |
|----------|--------|
| 🏗 Construction & Contracting | 5 |
| 🏠 Real Estate | 5 |
| 🏥 Clinic & Healthcare | 5 |
| 🍽 Restaurant & Café | 5 |
| 🎓 University & Education | 5 |
| 🛒 E-Commerce | 5 |
| ⚖ Law Firm | 5 |
| 🏨 Hotel & Tourism | 5 |

---

## Deployment

### VPS with PM2

```bash
# Build for production
npm run build

# Start with PM2
pm2 start npm --name "ai-platform" -- start -- -p 3003
pm2 save
pm2 startup
```

### Production Environment Variables

```bash
DATABASE_URL="file:/var/www/ai-platform/prisma/prod.db"
JWT_SECRET="your-strong-256-bit-secret"
ANTHROPIC_API_KEY="sk-ant-..."
```

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## License

MIT License — free for personal and commercial use.

---

<div align="center">

Built with ❤️ by the **AiFekr** team

[Live Demo](http://193.162.129.138) · [Report a Bug](https://github.com/inexpoaiagent/AIFekr/issues) · [Request a Feature](https://github.com/inexpoaiagent/AIFekr/issues)

</div>
