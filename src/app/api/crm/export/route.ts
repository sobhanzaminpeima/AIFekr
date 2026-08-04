export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { resolveCrmWorkspace } from "@/lib/crm/workspace";

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const header = columns.join(",");
  const body = rows.map((row) => columns.map((c) => csvEscape(row[c])).join(",")).join("\n");
  return `${header}\n${body}`;
}

/** Exports the workspace's CRM contacts or deals as CSV — ?type=contacts (default) | deals. Bulk export is manager/owner-only — an AGENT exporting the full contact list would defeat the point of per-agent visibility. */
export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  if (ws.isAgentRestricted) return NextResponse.json({ error: "فقط مدیر یا مالک می‌تواند خروجی کامل بگیرد" }, { status: 403 });

  const type = req.nextUrl.searchParams.get("type") === "deals" ? "deals" : "contacts";

  let csv: string;
  if (type === "deals") {
    const deals = await prisma.crmDeal.findMany({
      where: { userId: ws.workspaceUserId },
      include: { contact: { select: { name: true } }, stage: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 5000,
    });
    csv = toCsv(
      deals.map((d) => ({
        title: d.title, value: d.value, status: d.status, stage: d.stage.name, contact: d.contact.name,
        probability: d.probability, expectedCloseDate: d.expectedCloseDate?.toISOString() || "", createdAt: d.createdAt.toISOString(),
      })),
      ["title", "value", "status", "stage", "contact", "probability", "expectedCloseDate", "createdAt"]
    );
  } else {
    const contacts = await prisma.crmContact.findMany({ where: { userId: ws.workspaceUserId }, orderBy: { createdAt: "desc" }, take: 5000 });
    csv = toCsv(
      contacts.map((c) => ({
        name: c.name, phone: c.phone || "", email: c.email || "", company: c.company || "",
        status: c.status, source: c.source || "", totalSpent: c.totalSpent, createdAt: c.createdAt.toISOString(),
      })),
      ["name", "phone", "email", "company", "status", "source", "totalSpent", "createdAt"]
    );
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="crm-${type}.csv"`,
    },
  });
}
