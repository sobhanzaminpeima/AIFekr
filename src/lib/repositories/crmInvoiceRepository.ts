import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";

export interface InvoiceItemInput {
  productId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
}

/** Validates and totals invoice line items — shared by create and edit so the math (and its validation) can never drift between the two paths. */
export function computeInvoiceTotals(items: InvoiceItemInput[]) {
  let subtotal = 0;
  let taxTotal = 0;
  const itemsData = items.map((it) => {
    if (!it.description?.trim() || typeof it.unitPrice !== "number" || it.unitPrice < 0) {
      throw new Error("آیتم فاکتور نامعتبر است");
    }
    const qty = typeof it.quantity === "number" && it.quantity > 0 ? it.quantity : 1;
    const taxRate = typeof it.taxRate === "number" ? it.taxRate : 0;
    const lineSubtotal = qty * it.unitPrice;
    const lineTax = lineSubtotal * (taxRate / 100);
    subtotal += lineSubtotal;
    taxTotal += lineTax;
    return {
      description: it.description.trim(),
      quantity: qty,
      unitPrice: it.unitPrice,
      taxRate,
      lineTotal: lineSubtotal + lineTax,
      productId: it.productId || undefined,
    };
  });
  return { itemsData, subtotal, taxTotal };
}

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
