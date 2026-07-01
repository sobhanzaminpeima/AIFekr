<div align="center">

<img src="public/logo.svg" alt="AiFekr Logo" width="80" />

# AiFekr — پلتفرم هوش مصنوعی
### AI Platform | چت • تصویر • ویدیو • موزیک • ابزارهای کسب‌وکار

[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://typescriptlang.org)
[![Prisma](https://img.shields.io/badge/Prisma-5-2D3748?logo=prisma)](https://prisma.io)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38bdf8?logo=tailwindcss)](https://tailwindcss.com)
[![Claude AI](https://img.shields.io/badge/Powered_by-Claude_AI-ea580c)](https://anthropic.com)

**[🌐 Live Demo](http://193.162.129.138)**

</div>

---

## 📋 درباره پروژه / About

**AiFekr** یک پلتفرم جامع هوش مصنوعی است که امکانات ChatGPT، Midjourney، و ابزارهای تخصصی کسب‌وکار را در یک محصول فارسی/انگلیسی ارائه می‌دهد.

AiFekr is a full-featured AI platform combining ChatGPT-like chat, image/video/music generation, and specialized business AI tools — built with full FA/EN bilingual support.

---

## ✨ ویژگی‌های اصلی / Features

### 🤖 چت هوش مصنوعی / AI Chat
- چت استریمینگ با Claude (Haiku / Sonnet / Opus)
- **ورودی صوتی** — ارسال پیام با صدا (Web Speech API)
- **خروجی صوتی** — پخش پاسخ با صدا (TTS) مثل ChatGPT
- تاریخچه مکالمات با عنوان‌بندی خودکار
- پشتیبانی از Markdown، کد، جداول

### 🎨 تولید محتوا / Content Generation
- **ساخت تصویر** — با Fal.ai و Replicate
- **ساخت ویدیو** — مدل‌های تولید ویدیو AI
- **ساخت موزیک** — تولید موزیک با AI

### 🏢 ابزارهای کسب‌وکار / Business Tools
| ابزار | توضیح |
|-------|-------|
| 🩺 دکتر کسب‌وکار | تحلیل SWOT، KPI و برنامه اقدام |
| 👔 مشاور مدیرعامل | تصمیم‌گیری استراتژیک با AI |
| 🔍 فضای کار سئو | تحقیق کلمات کلیدی، بهینه‌سازی محتوا |
| 📱 شبکه‌های اجتماعی | تولید محتوای بهینه برای هر پلتفرم |
| 🌐 طراح وبسایت | طراحی کامل وبسایت با HTML خروجی |
| 🏭 بسته‌های صنعتی | تیم‌های AI تخصصی برای ۸ صنعت مختلف |
| 🎯 اتاق جلسه AI | شبیه‌سازی جلسه استراتژیک با چند Agent |

### 🌐 چندزبانه / Multilingual
- پشتیبانی کامل از **فارسی (RTL)** و **انگلیسی (LTR)**
- تغییر خودکار جهت صفحه (RTL ↔ LTR)
- محتوای بومی‌سازی شده برای هر زبان

### 💰 چندارزی / Multi-Currency
- پشتیبانی از USD، EUR، AED، GBP، IRR
- تبدیل قیمت خودکار با نرخ‌های قابل تنظیم

### 🔐 احراز هویت / Auth
- ثبت‌نام و ورود با ایمیل + رمز عبور
- JWT + کوکی امن
- سیستم پلن: رایگان، پایه، حرفه‌ای، تیمی
- اعتبار (Credits) برای هر عملیات

### ⚙️ پنل مدیریت / Admin Panel
- داشبورد کاربران، مکالمات، اعتبارها
- مدیریت بسته‌های صنعتی
- تنظیمات سایت (نام، ارز، زبان، ایمیل)
- نقش‌ها: ADMIN، SUPER_ADMIN

---

## 🛠 تکنولوژی‌ها / Tech Stack

```
Frontend:   Next.js 14 (App Router) + TypeScript + Tailwind CSS
Backend:    Next.js API Routes (Edge + Node.js)
Database:   SQLite (better-sqlite3) via Prisma ORM
AI:         Anthropic Claude API (@anthropic-ai/sdk)
Media:      Fal.ai (image/video), Replicate
Auth:       JWT (jsonwebtoken) + bcryptjs
Storage:    AWS S3 / Cloudflare R2
Deployment: Ubuntu 22.04 + PM2 (port 3003)
```

---

## 🚀 راه‌اندازی / Quick Start

### پیش‌نیازها / Prerequisites
- Node.js 18+
- npm 9+

### نصب / Installation

```bash
# Clone the repository
git clone https://github.com/inexpoaiagent/AIFekr.git
cd AIFekr

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env.local
# Edit .env.local with your keys

# Setup database
npx prisma generate
npx prisma migrate dev
npm run db:seed

# Start development server
npm run dev
```

باز کردن [http://localhost:3000](http://localhost:3000)

---

## 🔑 متغیرهای محیطی / Environment Variables

فایل `.env.local` را با مقادیر زیر تنظیم کنید:

```env
# Database
DATABASE_URL="file:./prisma/dev.db"

# Auth
JWT_SECRET="your-secret-key-here"

# AI - Required
ANTHROPIC_API_KEY="sk-ant-..."

# Media Generation - Optional
FAL_KEY="..."
REPLICATE_API_TOKEN="r8_..."

# Storage - Optional
AWS_ACCESS_KEY_ID="..."
AWS_SECRET_ACCESS_KEY="..."
AWS_REGION="..."
AWS_BUCKET_NAME="..."
```

---

## 📁 ساختار پروژه / Project Structure

```
src/
├── app/
│   ├── (dashboard)/          # Protected dashboard pages
│   │   ├── chat/             # AI Chat
│   │   ├── image/            # Image generation
│   │   ├── video/            # Video generation
│   │   ├── music/            # Music generation
│   │   ├── business-doctor/  # Business Doctor tool
│   │   ├── ceo/              # CEO Advisor
│   │   ├── seo/              # SEO Workspace
│   │   ├── social/           # Social Media Agent
│   │   ├── website-designer/ # Website Designer
│   │   ├── industry/         # Industry Packs
│   │   ├── meeting/          # AI Meeting Room
│   │   └── settings/         # User settings
│   ├── admin/                # Admin panel (ADMIN role)
│   ├── api/                  # API routes
│   │   ├── auth/             # Login, register, logout
│   │   ├── chat/             # Streaming chat endpoint
│   │   ├── admin/            # Admin APIs
│   │   └── ...
│   ├── login/                # Login page
│   ├── register/             # Register page
│   └── page.tsx              # Landing page
├── components/
│   ├── chat/                 # ChatInterface (voice in/out)
│   ├── landing/              # Landing page components (DemoChat)
│   ├── layout/               # Sidebar (bilingual)
│   └── ui/                   # LanguageSwitcher, CurrencySelector
├── lib/
│   ├── auth/                 # JWT helpers
│   ├── db/                   # Prisma client
│   ├── i18n/                 # FA/EN translations
│   └── currency.ts           # Multi-currency utils
└── prisma/
    ├── schema.prisma
    └── seed.ts               # Initial data (users, industry packs)
```

---

## 🏭 بسته‌های صنعتی / Industry Packs

۸ بسته تخصصی با Agent های هوش مصنوعی برای صنایع مختلف:

| صنعت | تعداد Agent |
|------|------------|
| 🏗 ساختمان و پیمانکاری | 5 |
| 🏠 مشاور املاک | 5 |
| 🏥 کلینیک و درمانگاه | 5 |
| 🍽 رستوران و کافه | 5 |
| 🎓 دانشگاه و آموزش | 5 |
| 🛒 فروشگاه آنلاین | 5 |
| ⚖ دفتر وکالت | 5 |
| 🏨 هتل و گردشگری | 5 |

---

## 🚢 استقرار / Deployment

### با PM2 روی VPS

```bash
# Build
npm run build

# Start with PM2
pm2 start npm --name "ai-platform" -- start -- -p 3003
pm2 save
pm2 startup
```

### متغیرهای محیطی Production

```bash
# Production DB
DATABASE_URL="file:/var/www/ai-platform/prisma/prod.db"

# Strong JWT secret
JWT_SECRET="your-production-secret-256-bit"

# AI Keys
ANTHROPIC_API_KEY="sk-ant-..."
```

---

## 📱 صفحه‌نمایش / Screenshots

| لندینگ / Landing | چت / Chat | پنل ادمین / Admin |
|:---:|:---:|:---:|
| صفحه فرود دوزبانه با دموی زنده | چت استریمینگ با ورودی/خروجی صوتی | مدیریت کامل سایت |

---

## 🤝 مشارکت / Contributing

1. Fork کنید
2. Branch بسازید: `git checkout -b feature/amazing-feature`
3. Commit کنید: `git commit -m 'Add amazing feature'`
4. Push کنید: `git push origin feature/amazing-feature`
5. Pull Request باز کنید

---

## 📄 لایسنس / License

MIT License — آزاد برای استفاده شخصی و تجاری

---

<div align="center">

ساخته شده با ❤️ توسط تیم **AiFekr**

[aifekr.com](http://193.162.129.138) · [گزارش باگ](https://github.com/inexpoaiagent/AIFekr/issues) · [درخواست ویژگی](https://github.com/inexpoaiagent/AIFekr/issues)

</div>
