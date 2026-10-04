export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { voiceSettings } from "@/lib/voice/settings";
import { getAvailableCredits } from "@/lib/utils/teamCredits";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const settings = await voiceSettings();
  const configured = !!(settings.apiKey && settings.webhookSecret && settings.credentialId);
  // Customers cannot allocate another customer's/provider's purchased numbers.
  const allocated = await prisma.voiceAgent.findMany({ where: { userId: user.id, vapiPhoneNumberId: { not: null } }, select: { vapiPhoneNumberId: true, phoneNumber: true } });
  const numbers = allocated.map(a => ({id:a.vapiPhoneNumberId, number:a.phoneNumber}));
  return NextResponse.json({ configured, numbers, credits: await getAvailableCredits(user.id), creditsPerMinute: settings.creditsPerMinute, maxDurationSeconds: settings.maxDurationSeconds, reservationCredits: Math.ceil(settings.maxDurationSeconds / 60 * settings.creditsPerMinute), numberAssignment: "admin" });
}
