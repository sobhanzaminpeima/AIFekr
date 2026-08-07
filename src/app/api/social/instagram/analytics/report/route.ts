export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { getAccountStats, getRecentMedia } from "@/lib/instagram";
import { routedStreamChat } from "@/lib/ai/router";

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const { language } = await req.json().catch(() => ({ language: "fa" }));
  const lang = language === "en" ? "en" : "fa";

  const conn = await prisma.instagramConnection.findUnique({ where: { userId: user.id } });
  if (!conn) return NextResponse.json({ error: "اینستاگرام متصل نیست" }, { status: 400 });

  const [snapshots, current] = await Promise.all([
    prisma.instagramFollowerSnapshot.findMany({ where: { userId: user.id }, orderBy: { date: "asc" }, take: 90 }),
    getAccountStats(conn.igUserId, conn.accessToken).catch(() => null),
  ]);

  let media: Awaited<ReturnType<typeof getRecentMedia>> = [];
  try {
    media = await getRecentMedia(conn.igUserId, conn.accessToken, 12);
  } catch {}

  const first = snapshots[0];
  const last = snapshots[snapshots.length - 1];
  const followerChange = first && last ? last.followersCount - first.followersCount : 0;
  const daysTracked = first && last ? Math.max(1, Math.round((last.date.getTime() - first.date.getTime()) / 86400000)) : 0;

  const mediaSummary = media
    .map((m, i) => `${i + 1}. [${m.mediaType}] ${(m.caption || "").slice(0, 80).replace(/\n/g, " ")} — ${m.likeCount} likes, ${m.commentsCount} comments (${new Date(m.timestamp).toISOString().slice(0, 10)})`)
    .join("\n");

  const dataSummary = `Instagram account: @${conn.igUsername || "unknown"}
Current followers: ${current?.followersCount ?? "unknown"}
Current post count: ${current?.mediaCount ?? "unknown"}
Follower change over last ${daysTracked} tracked day(s): ${followerChange >= 0 ? "+" : ""}${followerChange}
Recent posts (${media.length}):
${mediaSummary || "(no recent posts found)"}`;

  const systemPrompt = lang === "en"
    ? "You are an elite Instagram growth strategist and social media marketing analyst. Analyze the account data given to you and produce a clear, actionable report in markdown. Write ENTIRELY in fluent professional English — never mix in Chinese, Korean, Thai, Hindi, or any other language's words or characters."
    : "تو یک استراتژیست ارشد رشد اینستاگرام و تحلیل‌گر مارکتینگ شبکه‌های اجتماعی هستی. داده‌های پیج زیر رو تحلیل کن و یک گزارش واضح و عملی به فرمت markdown فارسی بنویس. کل گزارش رو کاملاً و فقط به فارسی روان بنویس — هرگز کلمه یا کاراکتر از زبان‌های دیگر (چینی، کره‌ای، تایلندی، هندی، ویتنامی و غیره) قاطی متن نکن.";

  const userMessage = lang === "en"
    ? `Here is the real data for this Instagram account:\n\n${dataSummary}\n\nWrite a structured report with these sections: 1) Follower Growth Trend (diagnose the pace, healthy or stalling), 2) Content Performance (which posts/types are working, patterns in engagement), 3) Page Health Review (overall assessment), 4) 30-Day Action Plan (concrete, prioritized, specific to this data — not generic advice). Use markdown headers and bullet points. Be direct and specific, referencing actual numbers from the data.`
    : `این داده‌های واقعی پیج اینستاگرام است:\n\n${dataSummary}\n\nیک گزارش ساختاریافته با این بخش‌ها بنویس: ۱) روند رشد فالوور (تشخیص بده سرعت رشد سالمه یا راکده)، ۲) عملکرد محتوا (کدوم پست‌ها/نوع محتوا بهتر عمل کردن، الگوهای تعامل)، ۳) بررسی کلی سلامت پیج، ۴) برنامه‌ی عملی ۳۰ روزه (مشخص، اولویت‌بندی‌شده، متناسب با همین داده‌ها — نه توصیه‌ی کلی). از هدینگ و بولت‌پوینت markdown استفاده کن. مستقیم و دقیق بنویس و به اعداد واقعی داده اشاره کن.`;

  let report = "";
  try {
    await routedStreamChat([{ role: "user", content: userMessage }], systemPrompt, (chunk) => { report += chunk; }, () => {});
  } catch (e) {
    const msg = e instanceof Error ? e.message : "خطا";
    return NextResponse.json({ error: `خطا در تحلیل: ${msg}` }, { status: 502 });
  }

  return NextResponse.json({ report });
}
