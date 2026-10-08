export const dynamic = "force-dynamic";
import { randomBytes } from "crypto";
import dns from "dns/promises";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { scopedSeoSite, seoScope, SeoError } from "@/lib/seo/intelligence/scope";
import { safeFetch } from "@/lib/net/safeUrl";
import { publicSeoConfig, getSeoProviderConfig } from "@/lib/seo/intelligence/config";
import { rateLimit } from "@/lib/utils/rateLimit";
export async function GET(req: NextRequest) {
  const user = await requireAuth(req); if (!user) return unauthorizedResponse(req);
  try {
    const scope = await seoScope(user.id);
    const sites = await prisma.seoSite.findMany({ where: { archivedAt: null, OR: [scope.where, { userId: user.id, businessId: null }] }, orderBy: { createdAt: "desc" }, select: { id: true, name: true, url: true, lastScore: true, lastAuditAt: true, verifiedAt: true, autoAudit: true, frequency: true } });
    const config = publicSeoConfig(await getSeoProviderConfig());
    return NextResponse.json({ sites, provider: { enabled: config.enabled, configured: config.configured, maxRows: config.maxRows } });
  } catch (error) { return NextResponse.json({ code: error instanceof SeoError ? error.code : "SEO_UNAVAILABLE" }, { status: error instanceof SeoError ? error.status : 503 }); }
}
export async function POST(req: NextRequest) {
  const user = await requireAuth(req); if (!user) return unauthorizedResponse(req);
  if (!rateLimit(`seo-verify:${user.id}`, 10, 60000).allowed) return NextResponse.json({ code: "RATE_LIMIT" }, { status: 429 });
  try {
    const body = await req.json();
    if (typeof body.siteId !== "string") throw new SeoError("INVALID_SITE");
    const { site } = await scopedSeoSite(user.id, body.siteId, true);
    let token = site.verificationToken;
    if (!token) {
      await prisma.seoSite.updateMany({ where: { id: site.id, verificationToken: null }, data: { verificationToken: randomBytes(24).toString("hex") } });
      token = (await prisma.seoSite.findUniqueOrThrow({ where: { id: site.id } })).verificationToken!;
    }
    const hostname = new URL(site.url).hostname;
    if (body.verify !== true) return NextResponse.json({ token: `aifekr-verification=${token}`, dnsName: `_aifekr.${hostname}`, fileUrl: new URL("/.well-known/aifekr-verification.txt", site.url).href });
    let verified = false;
    if (body.method === "dns") {
      const records = await Promise.race([dns.resolveTxt(`_aifekr.${hostname}`), new Promise<never>((_, reject) => setTimeout(() => reject(new Error("DNS_TIMEOUT")), 5000))]);
      verified = records.some(record => record.join("").trim() === `aifekr-verification=${token}`);
    } else if (body.method === "file") {
      const url = new URL("/.well-known/aifekr-verification.txt", site.url);
      const response = await safeFetch(url.href, { signal: AbortSignal.timeout(8000) }, 0);
      verified = response.ok && (await response.text()).trim() === `aifekr-verification=${token}`;
    } else throw new SeoError("INVALID_VERIFICATION_METHOD");
    if (!verified) throw new SeoError("VERIFICATION_NOT_FOUND", 422);
    await prisma.seoSite.update({ where: { id: site.id }, data: { verifiedAt: new Date() } });
    return NextResponse.json({ verified: true });
  } catch (error) { return NextResponse.json({ code: error instanceof SeoError ? error.code : "VERIFICATION_NOT_FOUND" }, { status: error instanceof SeoError ? error.status : 422 }); }
}
