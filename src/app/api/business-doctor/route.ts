export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { routedStreamChat } from "@/lib/ai/router";

const SYSTEM_PROMPT = `شما یک مشاور کسب‌وکار حرفه‌ای با ۲۰ سال تجربه هستید. پاسخ‌هایتان را به فارسی بدهید مگر کاربر انگلیسی بنویسد. تحلیل‌های دقیق، عملی و مبتنی بر داده ارائه دهید. از هدرهای markdown استفاده کنید.`;

async function getBusinessProfile(userId: string): Promise<Record<string, string>> {
  try {
    const company = await prisma.company.findUnique({ where: { userId } });
    if (!company) return {};
    let extra: Record<string, string> = {};
    try { extra = JSON.parse(company.notes || "{}"); } catch {}
    return {
      name: company.name,
      industry: company.industry,
      website: company.website || "",
      size: company.size || "",
      revenue: company.revenue || "",
      ...extra,
    };
  } catch { return {}; }
}

function buildPrompt(profile: Record<string, string>, question: string): string {
  const hasProfile = Object.keys(profile).length > 0;
  
  const profileSection = hasProfile ? `
## اطلاعات کسب‌وکار این کاربر (Knowledge Base):
- نام: ${profile.name || "نامشخص"}
- صنعت: ${profile.industry || "نامشخص"}
- اندازه تیم: ${profile.size || "نامشخص"}
- درآمد: ${profile.revenue || "نامشخص"}
- وب‌سایت: ${profile.website || "ندارد"}
- توضیح کسب‌وکار: ${profile.description || "ثبت نشده"}
- محصولات/خدمات: ${profile.products || "ثبت نشده"}
- مشتریان هدف: ${profile.targetCustomers || "ثبت نشده"}
- رقبا: ${profile.competitors || "ثبت نشده"}
- مزیت رقابتی: ${profile.uniqueValue || "ثبت نشده"}
- مدل کسب‌وکار: ${profile.businessModel || "ثبت نشده"}
- اهداف: ${profile.goals || "ثبت نشده"}
- چالش‌ها: ${profile.challenges || "ثبت نشده"}
- نقاط قوت: ${profile.strengths || "ثبت نشده"}
` : "";

  return `${profileSection}

## سوال/درخواست کاربر:
${question}

${hasProfile ? "لطفاً با توجه به اطلاعات کسب‌وکار بالا، پاسخ دقیق و شخصی‌سازی شده بدهید." : ""}`;
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  try {
    const body = await req.json();
    const { question, businessName, industry, revenue, teamSize, challenge, goals } = body;

    const profile = await getBusinessProfile(user.id);
    
    // Support both new (question) and legacy (form fields) mode
    const finalQuestion = question || `
تحلیل جامع کسب‌وکار:
- نام: ${businessName}
- صنعت: ${industry}
- درآمد: ${revenue}
- تیم: ${teamSize}
- چالش: ${challenge}
- اهداف: ${goals}

لطفاً یک گزارش تشخیص کامل با SWOT، چالش‌های کلیدی، برنامه عملیاتی ۳۰/۶۰/۹۰ روزه و KPIها ارائه دهید.`;

    const prompt = buildPrompt(profile, finalQuestion);
    let fullResult = "";

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          await routedStreamChat(
            [{ role: "user", content: prompt }],
            SYSTEM_PROMPT,
            (text) => {
              fullResult += text;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
            },
            (_provider) => {},
          );

          await prisma.businessAnalysis.create({
            data: {
              userId: user.id,
              businessName: profile.name || businessName || "نامشخص",
              industry: profile.industry || industry || "نامشخص",
              result: fullResult,
            },
          });

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          console.error("Business doctor stream error:", err);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "تحلیل با خطا مواجه شد" })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" },
    });
  } catch (err) {
    console.error("Business doctor error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const last = await prisma.businessAnalysis.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ analysis: last });
}