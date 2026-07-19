export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { routedStreamChat } from "@/lib/ai/router";

const STAGE_PROMPTS: Record<string, (data: unknown, lang: string) => string> = {
  idea: (data: unknown, lang: string) => {
    const d = data as { name?: string; description?: string; problem?: string; targetMarket?: string; solution?: string };
    if (lang === "fa") {
      return `تو یک متخصص استارتاپ هستی. بر اساس اطلاعات زیر، یک تحلیل کامل ایده استارتاپ ارائه بده:

نام: ${d.name || "نامشخص"}
توضیح: ${d.description || ""}
مشکل حل‌شده: ${d.problem || ""}
بازار هدف: ${d.targetMarket || ""}
راه‌حل: ${d.solution || ""}

لطفاً موارد زیر را با جزئیات کامل تولید کن:
1. **تحلیل ایده** — نقاط قوت، ضعف، فرصت‌ها، تهدیدها (SWOT)
2. **ارزش پیشنهادی** — چرا مشتری باید این محصول را انتخاب کند؟
3. **مزیت رقابتی** — چه چیزی تو را از رقبا متمایز می‌کند؟
4. **مدل کسب‌وکار پیشنهادی** — چطور درآمد کسب می‌کنی؟
5. **ریسک‌های اصلی** و راه‌حل مقابله با آن‌ها
6. **نقشه راه ۶ ماهه** — گام‌های عملی برای شروع

پاسخ را به فارسی روان و حرفه‌ای ارائه بده.`;
    }
    return `You are a startup expert. Based on the following information, provide a comprehensive startup idea analysis:

Name: ${d.name || "Unknown"}
Description: ${d.description || ""}
Problem Solved: ${d.problem || ""}
Target Market: ${d.targetMarket || ""}
Solution: ${d.solution || ""}

Please generate the following in detail:
1. **Idea Analysis** — Strengths, Weaknesses, Opportunities, Threats (SWOT)
2. **Value Proposition** — Why should customers choose this product?
3. **Competitive Advantage** — What sets you apart from competitors?
4. **Proposed Business Model** — How will you generate revenue?
5. **Key Risks** and mitigation strategies
6. **6-Month Roadmap** — Practical steps to get started

Provide a professional, detailed response.`;
  },

  financial: (data: unknown, lang: string) => {
    const d = data as { businessModel?: string; initialInvestment?: string; monthlyRevenue?: string; monthlyCosts?: string; growthRate?: string; teamSize?: string };
    if (lang === "fa") {
      return `تو یک مشاور مالی استارتاپ هستی. یک مدل مالی کامل و پروفرما برای ۳ سال اول تولید کن:

مدل کسب‌وکار: ${d.businessModel || ""}
سرمایه‌گذاری اولیه: ${d.initialInvestment || ""}
درآمد ماهانه پیش‌بینی: ${d.monthlyRevenue || ""}
هزینه‌های ماهانه: ${d.monthlyCosts || ""}
نرخ رشد پیش‌بینی: ${d.growthRate || ""}
اندازه تیم: ${d.teamSize || ""}

لطفاً موارد زیر را تولید کن:
1. **خلاصه مالی** — درآمد، هزینه، سود خالص ماه به ماه (سال ۱)
2. **جریان نقدی** — نقطه سر به سر (Break-even) کِی؟
3. **پیش‌بینی ۳ ساله** — جدول سالانه درآمد، هزینه، سود
4. **نیاز سرمایه‌گذاری** — چقدر پول لازم داری و برای چه؟
5. **KPI‌های مالی** — معیارهای موفقیت مالی
6. **استراتژی قیمت‌گذاری** — پیشنهاد قیمت محصول/خدمت

پاسخ را با اعداد مشخص و جداول واضح ارائه بده.`;
    }
    return `You are a startup financial advisor. Generate a complete financial model and proforma for the first 3 years:

Business Model: ${d.businessModel || ""}
Initial Investment: ${d.initialInvestment || ""}
Projected Monthly Revenue: ${d.monthlyRevenue || ""}
Monthly Costs: ${d.monthlyCosts || ""}
Growth Rate Forecast: ${d.growthRate || ""}
Team Size: ${d.teamSize || ""}

Please generate:
1. **Financial Summary** — Revenue, costs, net profit month by month (Year 1)
2. **Cash Flow** — When is the Break-even point?
3. **3-Year Forecast** — Annual revenue, cost, profit table
4. **Investment Needs** — How much capital and for what?
5. **Financial KPIs** — Financial success metrics
6. **Pricing Strategy** — Product/service price recommendations

Provide specific numbers and clear tables.`;
  },

  proposal: (data: unknown, lang: string) => {
    const d = data as { ideaAnalysis?: string; financialModel?: string; askAmount?: string; equity?: string; useOfFunds?: string; founderBackground?: string };
    if (lang === "fa") {
      return `تو یک متخصص تهیه پروپوزال سرمایه‌گذاری هستی. یک پروپوزال کامل و حرفه‌ای برای جذب سرمایه‌گذار بساز:

خلاصه ایده: ${d.ideaAnalysis || ""}
مدل مالی: ${d.financialModel || ""}
مبلغ مورد نیاز: ${d.askAmount || ""}
سهام پیشنهادی: ${d.equity || ""}
مصرف سرمایه: ${d.useOfFunds || ""}
پیشینه تیم: ${d.founderBackground || ""}

یک پروپوزال سرمایه‌گذاری کامل با این ساختار بساز:

**EXECUTIVE SUMMARY (خلاصه اجرایی)**
**THE PROBLEM (مشکل)**
**OUR SOLUTION (راه‌حل ما)**
**MARKET OPPORTUNITY (فرصت بازار)** — TAM, SAM, SOM
**BUSINESS MODEL (مدل درآمدی)**
**TRACTION & MILESTONES (پیشرفت‌ها)**
**COMPETITIVE LANDSCAPE (رقبا)**
**THE TEAM (تیم)**
**FINANCIALS (مالی)** — درآمد پیش‌بینی‌شده
**THE ASK (درخواست)** — مبلغ + کاربرد + سهام
**EXIT STRATEGY (استراتژی خروج)**

پروپوزال باید هیجان‌انگیز، مستدل و آماده ارائه به سرمایه‌گذار باشد.`;
    }
    return `You are an investment proposal specialist. Create a complete, professional investor proposal:

Idea Summary: ${d.ideaAnalysis || ""}
Financial Model: ${d.financialModel || ""}
Amount Needed: ${d.askAmount || ""}
Equity Offered: ${d.equity || ""}
Use of Funds: ${d.useOfFunds || ""}
Founder Background: ${d.founderBackground || ""}

Create a complete investor proposal with this structure:

**EXECUTIVE SUMMARY**
**THE PROBLEM**
**OUR SOLUTION**
**MARKET OPPORTUNITY** — TAM, SAM, SOM
**BUSINESS MODEL**
**TRACTION & MILESTONES**
**COMPETITIVE LANDSCAPE**
**THE TEAM**
**FINANCIALS** — Projected revenue
**THE ASK** — Amount + Use + Equity
**EXIT STRATEGY**

The proposal should be compelling, evidence-based, and ready to present to investors.`;
  },

  implementation: (data: unknown, lang: string) => {
    const d = data as { startupName?: string; techStack?: string; mvpFeatures?: string; launchTimeline?: string; teamRoles?: string };
    if (lang === "fa") {
      return `تو یک CTO و معمار فنی هستی. یک برنامه پیاده‌سازی کامل فنی و عملیاتی برای استارتاپ بساز:

نام استارتاپ: ${d.startupName || ""}
استک فنی: ${d.techStack || ""}
ویژگی‌های MVP: ${d.mvpFeatures || ""}
جدول زمانی لانچ: ${d.launchTimeline || ""}
نقش‌های تیم: ${d.teamRoles || ""}

لطفاً موارد زیر را با جزئیات کامل ارائه بده:

1. **معماری سیستم** — نمودار کلی معماری فنی
2. **Tech Stack پیشنهادی** — زبان، فریم‌ورک، دیتابیس، ابرزیرساخت
3. **MVP Roadmap** — ماه به ماه چه چیزی می‌سازی؟
4. **Sprint Plan (۳ ماه اول)** — وظایف هفتگی تیم توسعه
5. **ساختار تیم** — کدام نقش‌ها را اول استخدام کن
6. **چک‌لیست لانچ** — همه کارهای لازم قبل از لانچ
7. **سیستم‌های لازم** — CRM، Analytics، Support، Payment
8. **ریسک‌های فنی** و راه‌حل‌ها
9. **KPI‌های فنی** — معیارهای سنجش موفقیت
10. **هزینه‌های فنی** — برآورد هزینه سرورها، ابزارها

پاسخ را عملی، قابل اجرا و با جزئیات فنی کافی ارائه بده.`;
    }
    return `You are a CTO and technical architect. Create a complete technical and operational implementation plan for the startup:

Startup Name: ${d.startupName || ""}
Tech Stack: ${d.techStack || ""}
MVP Features: ${d.mvpFeatures || ""}
Launch Timeline: ${d.launchTimeline || ""}
Team Roles: ${d.teamRoles || ""}

Please provide detailed coverage of:

1. **System Architecture** — Overall technical architecture diagram
2. **Recommended Tech Stack** — Language, framework, database, cloud infrastructure
3. **MVP Roadmap** — What to build month by month
4. **Sprint Plan (First 3 Months)** — Weekly development team tasks
5. **Team Structure** — Which roles to hire first
6. **Launch Checklist** — Everything needed before launch
7. **Required Systems** — CRM, Analytics, Support, Payment
8. **Technical Risks** and mitigation
9. **Technical KPIs** — Success measurement metrics
10. **Technical Costs** — Server, tools cost estimates

Provide a practical, actionable response with sufficient technical detail.`;
  },
};

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { stage, data, lang = "fa" } = await req.json();
  if (!stage || !STAGE_PROMPTS[stage]) {
    return NextResponse.json({ error: "مرحله نامعتبر است" }, { status: 400 });
  }

  const systemPrompt = STAGE_PROMPTS[stage](data, lang);

  let fullText = "";
  try {
    await routedStreamChat(
      [{ role: "user" as const, content: systemPrompt }],
      "You are an expert startup advisor. Provide detailed, professional analysis.",
      (chunk) => { fullText += chunk; },
      () => {}
    );
  } catch (err) {
    console.error("Startup AI error:", err);
    return NextResponse.json({ error: "خطا در تولید محتوا" }, { status: 500 });
  }

  return NextResponse.json({ result: fullText });
}
