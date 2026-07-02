export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export interface BusinessProfile {
  name: string;
  industry: string;
  website?: string;
  phone?: string;
  email?: string;
  address?: string;
  size?: string;
  revenue?: string;
  description?: string;
  products?: string;
  targetCustomers?: string;
  competitors?: string;
  goals?: string;
  challenges?: string;
  strengths?: string;
  foundedYear?: string;
  businessModel?: string;
  uniqueValue?: string;
}

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const company = await prisma.company.findUnique({ where: { userId: user.id } });
  if (!company) return NextResponse.json({ profile: null });

  let extra: Record<string, string> = {};
  try { extra = JSON.parse(company.notes || "{}"); } catch {}

  const profile: BusinessProfile = {
    name: company.name,
    industry: company.industry,
    website: company.website || undefined,
    phone: company.phone || undefined,
    email: company.email || undefined,
    address: company.address || undefined,
    size: company.size || undefined,
    revenue: company.revenue || undefined,
    ...extra,
  };

  return NextResponse.json({ profile });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();

  const body: BusinessProfile = await req.json();
  const { name, industry, website, phone, email, address, size, revenue, ...extra } = body;

  if (!name || !industry) {
    return NextResponse.json({ error: "Name and industry are required" }, { status: 400 });
  }

  const notes = JSON.stringify(extra);

  const existing = await prisma.company.findUnique({ where: { userId: user.id } });

  if (existing) {
    await prisma.company.update({
      where: { userId: user.id },
      data: { name, industry, website, phone, email, address, size, revenue, notes },
    });
  } else {
    await prisma.company.create({
      data: { userId: user.id, name, industry, website: website || null, phone: phone || null, email: email || null, address: address || null, size: size || null, revenue: revenue || null, notes },
    });
  }

  return NextResponse.json({ success: true });
}