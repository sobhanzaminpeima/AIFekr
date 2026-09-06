import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { verifyOwnerSessionToken, OWNER_COOKIE } from "./ownerAuth";

/** Shared guard for every /api/owner/* route — resolves the owner_token cookie to a live CrmContact, or null. */
export async function requireOwner(req: NextRequest) {
  const token = req.cookies.get(OWNER_COOKIE)?.value;
  if (!token) return null;
  const contactId = verifyOwnerSessionToken(token);
  if (!contactId) return null;
  return prisma.crmContact.findUnique({ where: { id: contactId }, select: { id: true, name: true, email: true } });
}
