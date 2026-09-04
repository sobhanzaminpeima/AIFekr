import { prisma } from "@/lib/db/prisma";

/**
 * VAT/tax reporting (spec ۳.۷). Output tax comes from CrmInvoiceItem's
 * existing per-line taxRate — no new invoice schema needed. Input tax comes
 * from AccountingExpense.taxAmount (Phase C addition). This is a report,
 * not a new tax engine — rates themselves are just a named picklist
 * (AccountingTaxRate) an admin manages for use when creating invoices/bills.
 */

export interface VatReport {
  from: Date;
  to: Date;
  outputTax: number; // tax charged to customers on sales invoices
  inputTax: number; // tax paid to vendors on expenses
  netPayable: number; // outputTax - inputTax — positive means owed to the tax authority
}

export async function getVatReport(workspaceUserId: string, from: Date, to: Date): Promise<VatReport> {
  const invoices = await prisma.crmInvoice.findMany({
    where: { userId: workspaceUserId, status: { in: ["sent", "paid", "overdue"] }, issueDate: { gte: from, lte: to } },
    select: { taxTotal: true },
  });
  const outputTax = invoices.reduce((s, i) => s + i.taxTotal, 0);

  const expenses = await prisma.accountingExpense.findMany({
    where: { workspaceUserId, status: { in: ["approved", "paid"] }, expenseDate: { gte: from, lte: to } },
    select: { taxAmount: true },
  });
  const inputTax = expenses.reduce((s, e) => s + e.taxAmount, 0);

  return { from, to, outputTax, inputTax, netPayable: outputTax - inputTax };
}
