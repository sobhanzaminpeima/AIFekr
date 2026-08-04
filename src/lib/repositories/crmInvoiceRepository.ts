import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";

/**
 * Mints a per-user sequential invoice number like INV-2026-0001. There's no
 * separate counter table — we count this user's invoices issued this year
 * and retry on the unique-constraint conflict (P2002) if a concurrent
 * request won the same number, which is simpler than a locking table and
 * still race-safe because CrmInvoice.invoiceNumber is globally unique.
 */
export async function createInvoiceWithNumber(
  userId: string,
  data: Omit<Prisma.CrmInvoiceCreateInput, "invoiceNumber" | "user">,
  maxAttempts = 5
) {
  const year = new Date().getFullYear();
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const countThisYear = await prisma.crmInvoice.count({
      where: { userId, invoiceNumber: { startsWith: `INV-${year}-` } },
    });
    const seq = String(countThisYear + 1 + attempt).padStart(4, "0");
    const invoiceNumber = `INV-${year}-${seq}`;
    try {
      return await prisma.crmInvoice.create({
        data: { ...data, invoiceNumber, user: { connect: { id: userId } } },
        include: { items: true },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") continue;
      throw err;
    }
  }
  throw new Error("Could not mint a unique invoice number after several attempts");
}
