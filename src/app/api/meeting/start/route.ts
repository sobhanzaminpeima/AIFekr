export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { routedStreamChat } from "@/lib/ai/router";
import { getServerLang } from "@/lib/i18n/server";

// German has no dedicated meeting prompt yet (see src/lib/i18n/de.ts
// placeholder note) — fall back to English rather than Farsi.
type Lang = "fa" | "en";
function promptLang(l: "fa" | "en" | "de"): Lang {
  return l === "fa" ? "fa" : "en";
}

const AGENT_PERSONAS: Record<Lang, Record<string, string>> = {
  fa: {
    ceo: "شما مدیرعامل (CEO) هستید — رهبر دیدمند با تمرکز بر استراتژی کلی، ماموریت شرکت و رشد بلندمدت.",
    marketing: "شما مدیر بازاریابی هستید — متخصص رشد با تمرکز بر برندینگ، جذب مشتری، کمپین‌ها و جایگاه‌یابی بازار.",
    finance: "شما مدیر مالی (CFO) هستید — متخصص اعداد با تمرکز بر ROI، بودجه، جریان نقدی و ریسک‌های مالی.",
    seo: "شما متخصص سئو هستید — کارشناس دیجیتال با تمرکز بر رتبه‌بندی موتور جستجو، ترافیک ارگانیک و استراتژی محتوا.",
    sales: "شما مدیر فروش هستید — متخصص درآمد با تمرکز بر pipeline فروش، بستن معاملات و روابط مشتری.",
    product: "شما مدیر محصول هستید — متخصص کاربر-محور با تمرکز بر roadmap محصول، ویژگی‌ها و تجربه کاربری.",
    legal: "شما مشاور حقوقی هستید — متخصص ریسک با تمرکز بر انطباق، قراردادها و مسائل قانونی.",
  },
  en: {
    ceo: "You are the CEO — a visionary leader focused on overall strategy, company mission, and long-term growth.",
    marketing: "You are the Marketing Director — a growth specialist focused on branding, customer acquisition, campaigns, and market positioning.",
    finance: "You are the CFO — a numbers specialist focused on ROI, budgeting, cash flow, and financial risk.",
    seo: "You are the SEO Specialist — a digital expert focused on search engine rankings, organic traffic, and content strategy.",
    sales: "You are the Sales Director — a revenue specialist focused on the sales pipeline, closing deals, and customer relationships.",
    product: "You are the Product Manager — a user-focused specialist covering the product roadmap, features, and user experience.",
    legal: "You are Legal Counsel — a risk specialist focused on compliance, contracts, and legal matters.",
  },
};

const AGENT_COLORS: Record<string, string> = {
  ceo: "#ea580c", marketing: "#8b5cf6", finance: "#10b981",
  seo: "#3b82f6", sales: "#f59e0b", product: "#ec4899", legal: "#6b7280",
};

async function getBusinessProfile(userId: string, lang: Lang): Promise<string> {
  try {
    const company = await prisma.company.findUnique({ where: { userId } });
    if (!company) return "";
    let extra: Record<string, string> = {};
    try { extra = JSON.parse(company.notes || "{}"); } catch {}

    const profile = { name: company.name, industry: company.industry, size: company.size, revenue: company.revenue, ...extra };

    const labels = lang === "en"
      ? { company: "Company", industry: "Industry", size: "Team size", revenue: "Revenue", description: "Description", products: "Products/Services", targetCustomers: "Target customers", competitors: "Competitors", uniqueValue: "Competitive edge", goals: "Goals", challenges: "Challenges" }
      : { company: "شرکت", industry: "صنعت", size: "اندازه تیم", revenue: "درآمد", description: "توضیح", products: "محصولات/خدمات", targetCustomers: "مشتریان هدف", competitors: "رقبا", uniqueValue: "مزیت رقابتی", goals: "اهداف", challenges: "چالش‌ها" };

    const lines = [
      `${labels.company}: ${profile.name}`,
      `${labels.industry}: ${profile.industry}`,
      profile.size && `${labels.size}: ${profile.size}`,
      profile.revenue && `${labels.revenue}: ${profile.revenue}`,
      extra.description && `${labels.description}: ${extra.description}`,
      extra.products && `${labels.products}: ${extra.products}`,
      extra.targetCustomers && `${labels.targetCustomers}: ${extra.targetCustomers}`,
      extra.competitors && `${labels.competitors}: ${extra.competitors}`,
      extra.uniqueValue && `${labels.uniqueValue}: ${extra.uniqueValue}`,
      extra.goals && `${labels.goals}: ${extra.goals}`,
      extra.challenges && `${labels.challenges}: ${extra.challenges}`,
    ].filter(Boolean);

    return lines.join("\n");
  } catch { return ""; }
}

function buildMeetingPrompt(topic: string, agents: string[], businessContext: string, lang: Lang) {
  const personas = AGENT_PERSONAS[lang];
  const agentList = agents.map((a) => `- ${a.toUpperCase()}: ${personas[a] || a}`).join("\n");

  if (lang === "en") {
    const contextSection = businessContext ? `\n## Company Info (Knowledge Base):\n${businessContext}\n` : "";
    return `You are facilitating a strategic business meeting. The following agents are present:

${agentList}
${contextSection}
## Meeting topic: ${topic}

Simulate a realistic, useful meeting in the following format (in English):

---Phase 1: Opening statements---
Each agent gives a brief take on the topic (2-3 sentences).
Format: **[Agent name]:** [statement]

---Phase 2: Discussion---
Agents reference each other's points, challenge them, and build on ideas. At least 2 exchanges per agent.
Format: **[Agent name]:** [statement]

---Phase 3: Decisions and action items---
**Agreed decisions:**
1. [decision]
2. [decision]

**Action items:**
- [ ] [task] — Owner: [agent], Deadline: [timeframe]
- [ ] [task] — Owner: [agent], Deadline: [timeframe]

**Meeting summary:**
[2-3 sentences on the outcome]

Agents should occasionally disagree and negotiate. Each agent should stay in character.`;
  }

  const contextSection = businessContext ? `\n## اطلاعات شرکت (Knowledge Base):\n${businessContext}\n` : "";
  return `شما مجری یک جلسه استراتژیک کسب‌وکار هستید. ایجنت‌های زیر در جلسه شرکت دارند:

${agentList}
${contextSection}
## موضوع جلسه: ${topic}

یک جلسه واقعی و کاربردی را در قالب زیر شبیه‌سازی کنید (به فارسی):

---فاز ۱: بیانیه‌های افتتاحیه---
هر ایجنت دیدگاه کوتاه خود را نسبت به موضوع بیان می‌کند (۲-۳ جمله).
قالب: **[نام ایجنت]:** [بیانیه]

---فاز ۲: بحث و تبادل نظر---
ایجنت‌ها به دیدگاه‌های یکدیگر اشاره می‌کنند، چالش می‌کشند و ایده‌ها را توسعه می‌دهند. حداقل ۲ تبادل برای هر ایجنت.
قالب: **[نام ایجنت]:** [بیانیه]

---فاز ۳: تصمیمات و اقدامات---
**تصمیمات مورد توافق:**
۱. [تصمیم]
۲. [تصمیم]

**اقدامات:**
- [ ] [وظیفه] — مسئول: [ایجنت]، مهلت: [بازه زمانی]
- [ ] [وظیفه] — مسئول: [ایجنت]، مهلت: [بازه زمانی]

**خلاصه جلسه:**
[۲-۳ جمله درباره نتایج]

ایجنت‌ها گاهی اوقات اختلاف نظر داشته باشند و مذاکره کنند. هر ایجنت در نقش خود بماند.`;
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const lang = promptLang(await getServerLang());

  try {
    const { topic, agents } = await req.json();

    if (!topic || !agents?.length || agents.length < 2) {
      return NextResponse.json(
        { error: lang === "en" ? "Topic and at least 2 agents are required" : "موضوع و حداقل ۲ ایجنت الزامی است" },
        { status: 400 }
      );
    }

    const businessContext = await getBusinessProfile(user.id, lang);

    const conv = await prisma.conversation.create({
      data: { userId: user.id, title: `Meeting: ${topic.slice(0, 50)}`, tool: "meeting", model: "auto" },
    });

    const prompt = buildMeetingPrompt(topic, agents, businessContext, lang);
    let fullTranscript = "";

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const agentColors = JSON.stringify(AGENT_COLORS);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ meta: { agentColors, conversationId: conv.id, hasBusinessContext: !!businessContext } })}\n\n`));

        try {
          await routedStreamChat(
            [{ role: "user", content: prompt }],
            lang === "en"
              ? "You are an AI meeting facilitator running strategic meetings with multiple agents."
              : "شما مجری جلسه هوش مصنوعی هستید که جلسات استراتژیک با چند ایجنت برگزار می‌کنید.",
            (text) => {
              fullTranscript += text;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
            },
            (_provider) => {},
          );

          await prisma.message.create({
            data: {
              conversationId: conv.id,
              role: "user",
              content: lang === "en" ? `Meeting topic: ${topic}\nAgents: ${agents.join(", ")}` : `موضوع جلسه: ${topic}\nایجنت‌ها: ${agents.join(", ")}`,
            },
          });
          await prisma.message.create({
            data: { conversationId: conv.id, role: "assistant", content: fullTranscript },
          });

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          console.error("Meeting stream error:", err);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: lang === "en" ? "The meeting failed" : "جلسه با خطا مواجه شد" })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" },
    });
  } catch (err) {
    console.error("Meeting error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
