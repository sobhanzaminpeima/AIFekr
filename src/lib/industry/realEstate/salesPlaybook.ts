import { prisma } from "@/lib/db/prisma";
import { registerSalesPlaybook, type SalesFollowUpContext } from "../registry";

/**
 * Stage-aware tone guidance for a real-estate deal's current pipeline stage
 * (stage names come from src/lib/crm/industryTemplates.ts's real-estate
 * template — this is prose guidance for the LLM, not a strict enum, so an
 * unrecognized/customized stage name just falls through to no extra tone).
 */
const STAGE_TONE: Record<string, string> = {
  "لید جدید": "لحن آشناسازی و معرفی اولیه؛ دعوت به تعیین وقت بازدید.",
  "بازدید": "اگر مدتی از بازدید گذشته و بازخوردی نگرفتی، مؤدبانه نظر بازدید را بپرس و نگرانی احتمالی را برطرف کن — هرگز اصرار نکن.",
  "مذاکره": "لحن مطمئن و حرفه‌ای؛ روی نقاط قوت ملک تأکید کن. هرگز عدد، تخفیف یا شرایط مالی/قراردادی در پیام پیشنهاد نده — این تصمیم فقط با کارشناس انسانی است.",
  "قرارداد": "یادآوری مؤدبانهٔ مدارک/مراحل باقی‌مانده؛ لحن مطمئن‌کننده.",
};

async function buildFollowUpGuidance(userId: string, ctx: SalesFollowUpContext): Promise<string | null> {
  try {
    const lines: string[] = [];

    if (ctx.dealStage && STAGE_TONE[ctx.dealStage]) {
      lines.push(`راهنمای لحن برای مرحله «${ctx.dealStage}»: ${STAGE_TONE[ctx.dealStage]}`);
    }

    // Similar-property suggestion — only meaningful once the lead's
    // interest is linked to an actual Property row (via Property.crmDealId,
    // see the CRM/voice-agent Property unification). If that link is
    // missing or incomplete, this section is silently skipped rather than
    // failing the whole guidance.
    const deal = await prisma.crmDeal.findFirst({
      where: { userId, contactId: ctx.contactId, status: "open" },
      select: { id: true },
    });
    if (deal) {
      const property = await prisma.property.findFirst({ where: { crmDealId: deal.id } });
      if (property) {
        const priceNum = Number(property.price);
        const similar = await prisma.property.findMany({
          where: {
            userId,
            id: { not: property.id },
            status: "available",
            propertyType: property.propertyType,
            ...(property.city ? { city: property.city } : {}),
            price: {
              gte: BigInt(Math.round(priceNum * 0.8)),
              lte: BigInt(Math.round(priceNum * 1.2)),
            },
          },
          take: 2,
        });
        if (similar.length) {
          const list = similar.map((p) => `${p.title} (${p.address}، ${Number(p.price).toLocaleString("fa-IR")} تومان)`).join("، ");
          lines.push(`اگر لید نسبت به ملک قبلی سکوت کرده یا رد کرده، این ملک‌های مشابه را به‌عنوان جایگزین پیشنهاد بده: ${list}`);
        }
      }
    }

    return lines.length ? lines.join("\n") : null;
  } catch (err) {
    console.error("real-estate sales playbook error (falling back to generic):", err);
    return null;
  }
}

registerSalesPlaybook({ slug: "real-estate", buildFollowUpGuidance });
