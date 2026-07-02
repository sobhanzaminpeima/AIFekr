export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { routedStreamChat } from "@/lib/ai/router";

const AGENT_PERSONAS: Record<string, string> = {
  ceo: "شما مدیرعامل (CEO) هستید — رهبر دیدمند با تمرکز بر استراتژی کلی، ماموریت شرکت و رشد بلندمدت.",
  marketing: "شما مدیر بازاریابی هستید — متخصص رشد با تمرکز بر برندینگ، جذب مشتری، کمپین‌ها و جایگاه‌یابی بازار.",
  finance: "شما مدیر مالی (CFO) هستید — متخصص اعداد با تمرکز بر ROI، بودجه، جریان نقدی و ریسک‌های مالی.",
  seo: "شما متخصص سئو هستید — کارشناس دیجیتال با تمرکز بر رتبه‌بندی موتور جستجو، ترافیک ارگانیک و استراتژی محتوا.",
  sales: "شما مدیر فروش هستید — متخصص درآمد با تمرکز بر pipeline فروش، بستن معاملات و روابط مشتری.",
  product: "شما مدیر محصول هستید — متخصص کاربر-محور با تمرکز بر roadmap محصول، ویژگی‌ها و تجربه کاربری.",
  legal: "شما مشاور حقوقی هستید — متخصص ریسک با تمرکز بر انطباق، قراردادها و مسائل قانونی.",
};

const AGENT_COLORS: Record<string, string> = {
  ceo: "#ea580c", marketing: "#8b5cf6", finance: "#10b981",
  seo: "#3b82f6", sales: "#f59e0b", product: "#ec4899", legal: "#6b7280",
};

async function getBusinessProfile(userId: string): Promise<string> {
  try {
    const company = await prisma.company.findUnique({ where: { userId } });
    if (!company) return "";
    let extra: Record<string, string> = {};
    try { extra = JSON.parse(company.notes || "{}"); } catch {}
    
    const profile = { name: company.name, industry: company.industry, size: company.size, revenue: company.revenue, ...extra };
    
    const lines = [
      `شرکت: ${profile.name}`,
      `صنعت: ${profile.industry}`,
      profile.size && `اندازه تیم: ${profile.size}`,
      profile.revenue && `درآمد: ${profile.revenue}`,
      extra.description && `توضیح: ${extra.description}`,
      extra.products && `محصولات/خدمات: ${extra.products}`,
      extra.targetCustomers && `مشتریان هدف: ${extra.targetCustomers}`,
      extra.competitors && `رقبا: ${extra.competitors}`,
      extra.uniqueValue && `مزیت رقابتی: ${extra.uniqueValue}`,
      extra.goals && `اهداف: ${extra.goals}`,
      extra.challenges && `چالش‌ها: ${extra.challenges}`,
    ].filter(Boolean);
    
    return lines.join("\n");
  } catch { return ""; }
}

function buildMeetingPrompt(topic: string, agents: string[], businessContext: string) {
  const agentList = agents.map((a) => `- ${a.toUpperCase()}: ${AGENT_PERSONAS[a] || a}`).join("\n");
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

  try {
    const { topic, agents } = await req.json();

    if (!topic || !agents?.length || agents.length < 2) {
      return NextResponse.json({ error: "موضوع و حداقل ۲ ایجنت الزامی است" }, { status: 400 });
    }

    const businessContext = await getBusinessProfile(user.id);

    const conv = await prisma.conversation.create({
      data: { userId: user.id, title: `Meeting: ${topic.slice(0, 50)}`, tool: "meeting", model: "auto" },
    });

    const prompt = buildMeetingPrompt(topic, agents, businessContext);
    let fullTranscript = "";

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const agentColors = JSON.stringify(AGENT_COLORS);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ meta: { agentColors, conversationId: conv.id, hasBusinessContext: !!businessContext } })}\n\n`));

        try {
          await routedStreamChat(
            [{ role: "user", content: prompt }],
            "شما مجری جلسه هوش مصنوعی هستید که جلسات استراتژیک با چند ایجنت برگزار می‌کنید.",
            (text) => {
              fullTranscript += text;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
            },
            (_provider) => {},
          );

          await prisma.message.create({
            data: { conversationId: conv.id, role: "user", content: `موضوع جلسه: ${topic}\nایجنت‌ها: ${agents.join(", ")}` },
          });
          await prisma.message.create({
            data: { conversationId: conv.id, role: "assistant", content: fullTranscript },
          });

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          console.error("Meeting stream error:", err);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "جلسه با خطا مواجه شد" })}\n\n`));
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