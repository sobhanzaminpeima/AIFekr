export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db/prisma";
import * as qwen from "@/lib/ai/qwen";
import * as openaiImage from "@/lib/ai/openaiImage";
import { uploadToStorage, getStorageKey } from "@/lib/storage/r2";
import { CREDIT_COSTS } from "@/lib/utils/credits";
import { deductCredits } from "@/lib/utils/teamCredits";
import { isFeatureEnabled, FEATURE_DISABLED_MESSAGE } from "@/lib/utils/featureToggles";

/**
 * Public, no-login image generation for the 1980s prompt gallery — a link
 * anyone can open and use directly (approved product decision: free for the
 * first generation per visitor, billed against the admin's own credit
 * balance; after that, the client is told to send the visitor to /plans).
 *
 * This is deliberately narrow: only prompts in category "1980s", and never
 * a free-text prompt — an open, unauthenticated free-text image endpoint
 * would be a spam/abuse magnet with no cost control at all. The per-visitor
 * cap is enforced with a signed cookie (COOKIE below), not just a client-side
 * counter, since a client-side-only limit is trivially bypassed by clearing
 * localStorage.
 */

const FREE_USES = 1;
const COOKIE_NAME = "aifekr_public_1980s_uses";
const COOKIE_SECRET = process.env.JWT_SECRET || "dev-fallback-do-not-use-in-prod";

// One-per-visitor is not a real cost ceiling by itself -- a link posted
// somewhere popular still means unbounded total spend against the admin's
// own credit balance. This is the actual budget control: once this many
// public generations have run today, everyone sees the same "come back
// tomorrow" message regardless of their own per-visitor cookie. Configurable
// via admin settings (SiteSetting) so it doesn't need a redeploy to change.
const DEFAULT_DAILY_CAP = 20;
const DAILY_CAP_SETTING_KEY = "public_share_1980s_daily_cap";

async function getDailyCap(): Promise<number> {
  const row = await prisma.siteSetting.findUnique({ where: { key: DAILY_CAP_SETTING_KEY } });
  const n = row ? parseInt(row.value, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_DAILY_CAP;
}

function sign(count: number): string {
  const mac = crypto.createHmac("sha256", COOKIE_SECRET).update(String(count)).digest("hex").slice(0, 16);
  return `${count}.${mac}`;
}
function verify(value: string | undefined): number {
  if (!value) return 0;
  const [countStr, mac] = value.split(".");
  const count = parseInt(countStr, 10);
  if (!Number.isFinite(count) || count < 0) return 0;
  const expected = crypto.createHmac("sha256", COOKIE_SECRET).update(String(count)).digest("hex").slice(0, 16);
  // A tampered cookie (wrong mac, or a hand-edited lower count) is treated as
  // the worst case for the visitor, not the best -- fall back to the cap
  // itself rather than 0, so clearing/editing the cookie can't reset it.
  return mac === expected ? count : FREE_USES;
}

let cachedAdminId: string | null = null;
async function getAdminCreditUserId(): Promise<string | null> {
  if (cachedAdminId) return cachedAdminId;
  const envId = process.env.PUBLIC_SHARE_CREDIT_USER_ID;
  if (envId) { cachedAdminId = envId; return envId; }
  const admin = await prisma.user.findFirst({ where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } }, orderBy: { createdAt: "asc" }, select: { id: true } });
  cachedAdminId = admin?.id ?? null;
  return cachedAdminId;
}

export async function POST(req: NextRequest) {
  if (!(await isFeatureEnabled("image"))) {
    return NextResponse.json({ error: FEATURE_DISABLED_MESSAGE.image }, { status: 503 });
  }

  const uses = verify(req.cookies.get(COOKIE_NAME)?.value);
  if (uses >= FREE_USES) {
    return NextResponse.json(
      { error: "تعداد رایگان تمام شد", limitReached: true, redirectTo: "/plans" },
      { status: 402 }
    );
  }

  try {
    // Global daily budget cap -- checked before touching the AI provider at
    // all, so a day that's already at its cap costs nothing further.
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
    const [dailyCap, todayCount] = await Promise.all([
      getDailyCap(),
      prisma.generatedImage.count({ where: { kind: "public_share", createdAt: { gte: dayStart } } }),
    ]);
    if (todayCount >= dailyCap) {
      return NextResponse.json(
        { error: "سقف روزانه‌ی این قابلیت پر شده — فردا دوباره امتحان کنید یا از پلن‌های AiFekr استفاده کنید.", dailyCapReached: true, redirectTo: "/plans" },
        { status: 503 }
      );
    }

    const { promptId, sourceImageUrls } = await req.json();
    if (!promptId) return NextResponse.json({ error: "promptId الزامی است" }, { status: 400 });

    const prompt = await prisma.prompt.findFirst({ where: { id: promptId, toolType: "image", category: "1980s", isActive: true } });
    if (!prompt) return NextResponse.json({ error: "پرامپت پیدا نشد" }, { status: 404 });

    const urls: string[] = Array.isArray(sourceImageUrls) ? sourceImageUrls.slice(0, 2) : [];
    if (urls.length === 0) return NextResponse.json({ error: "آپلود عکس الزامی است" }, { status: 400 });

    const adminId = await getAdminCreditUserId();
    if (!adminId) return NextResponse.json({ error: "این قابلیت موقتاً در دسترس نیست" }, { status: 503 });

    const admin = await prisma.user.findUnique({ where: { id: adminId }, select: { credits: true } });
    const creditCost = CREDIT_COSTS.image_standard;
    if (!admin || admin.credits < creditCost) {
      return NextResponse.json({ error: "این قابلیت موقتاً در دسترس نیست" }, { status: 503 });
    }

    // Portrait -- closest built-in ratio to the 3:4 several of these prompts
    // specify inline in their own instruction text anyway.
    const provider = openaiImage.isOpenAIImageAvailable ? openaiImage : qwen;
    const rawUrls = await provider.generateImageFromReference({ prompt: prompt.content, style: "realistic", ratio: "9:16", count: 1, imageUrls: urls });

    const finalUrls = await Promise.all(
      rawUrls.map(async (url, i) => {
        try {
          if (url.includes("placehold.co") || url.includes("picsum.photos")) return url;
          const key = getStorageKey(`public-${adminId}`, "image", `${Date.now()}-${i}.webp`);
          if (url.startsWith("data:")) {
            const buf = Buffer.from(url.split(",")[1] || "", "base64");
            return await uploadToStorage(buf, key, "image/webp");
          }
          const res = await fetch(url);
          const buf = Buffer.from(await res.arrayBuffer());
          return await uploadToStorage(buf, key, "image/webp");
        } catch {
          return url;
        }
      })
    );

    // This promo runs on the house (admin) account's balance. The decrement
    // used to be unguarded, so once that account ran dry it just went
    // negative and the free tool kept burning real provider money. Guarded
    // now — the image is already generated, so an exhausted house balance is
    // recorded and still served, but it can't silently overdraw.
    const charged = await prisma.$transaction(async (tx) => {
      const ok = await deductCredits(adminId, creditCost, tx);
      if (!ok) return false;
      await tx.generatedImage.create({
        data: { userId: adminId, prompt: prompt.content, style: "realistic", url: finalUrls[0], sourceImageUrl: urls[0], credits: creditCost, kind: "public_share" },
      });
      return true;
    });
    if (!charged) {
      console.error("public 1980s promo: house account out of credits", { adminId, creditCost });
    }
    await prisma.prompt.update({ where: { id: prompt.id }, data: { usedCount: { increment: 1 } } }).catch(() => null);

    const remaining = FREE_USES - (uses + 1);
    const res = NextResponse.json({ images: finalUrls, remaining });
    res.cookies.set(COOKIE_NAME, sign(uses + 1), {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });
    return res;
  } catch (e) {
    console.error("public 1980s generate error:", e);
    return NextResponse.json({ error: "خطا در تولید تصویر" }, { status: 500 });
  }
}
