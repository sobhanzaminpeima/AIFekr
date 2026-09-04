export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { resolveCrmWorkspace, hasCrmAccess } from "@/lib/crm/workspace";
import { isModuleEnabled } from "@/lib/industry/moduleAccess";
import { getServerLang } from "@/lib/i18n/server";
import { tri } from "@/lib/i18n/tri";
import { csvToObjects } from "@/lib/utils/csv";

const LISTING_TYPES = ["buy", "sell", "rent", "short_term_rent"];
const CURRENCIES = ["IRT", "IRR", "USD", "GBP", "EUR"];
const MAX_ROWS = 500;

interface RowError { row: number; error: string; }

async function checkPropertyModuleAccess(userId: string, role: string, workspaceUserId: string) {
  const owner = await prisma.user.findUnique({ where: { id: workspaceUserId }, select: { industryPackId: true } });
  return isModuleEnabled({ id: userId, role, industryPackId: owner?.industryPackId ?? null }, "crm.property");
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const ws = await resolveCrmWorkspace(user.id);
  const lang = await getServerLang();
  if (!hasCrmAccess(ws)) return NextResponse.json({ error: tri(lang, "این قابلیت نیاز به خرید افزونه CRM دارد", "This feature requires the CRM add-on", "Diese Funktion erfordert das CRM-Add-on") }, { status: 402 });
  if (!(await checkPropertyModuleAccess(user.id, user.role, ws.workspaceUserId))) {
    return NextResponse.json({ error: tri(lang, "این ماژول برای شما فعال نیست", "This module is not enabled for you", "Dieses Modul ist für Sie nicht aktiviert") }, { status: 403 });
  }
  if (ws.isAgentRestricted) {
    return NextResponse.json({ error: tri(lang, "فقط مدیر یا مالک می‌تواند ملک وارد کند", "Only a manager or owner can import properties", "Nur ein Manager oder Inhaber kann Immobilien importieren") }, { status: 403 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: tri(lang, "فایل CSV الزامی است", "A CSV file is required", "Eine CSV-Datei ist erforderlich") }, { status: 400 });
  }

  const text = await file.text();
  // Strip the template's leading "# ..." comment line(s), if present, so
  // re-uploading the downloaded template works without editing it first.
  const withoutComments = text.split(/\r\n|\r|\n/).filter((line) => !line.trimStart().startsWith("#")).join("\n");
  const rows = csvToObjects(withoutComments);

  if (rows.length === 0) {
    return NextResponse.json({ error: tri(lang, "هیچ ردیفی در فایل یافت نشد", "No rows found in the file", "Keine Zeilen in der Datei gefunden") }, { status: 400 });
  }
  if (rows.length > MAX_ROWS) {
    return NextResponse.json({ error: tri(lang, `حداکثر ${MAX_ROWS} ردیف در هر بار قابل وارد کردن است`, `A maximum of ${MAX_ROWS} rows can be imported at once`, `Es können maximal ${MAX_ROWS} Zeilen auf einmal importiert werden`) }, { status: 400 });
  }

  const errors: RowError[] = [];
  const toCreate: Array<Record<string, unknown>> = [];

  rows.forEach((row, i) => {
    const rowNum = i + 2; // +1 for 0-index, +1 for the header row itself
    const title = row.title?.trim();
    const listingType = row.listingType?.trim();
    const address = row.address?.trim();
    const currency = row.currency?.trim() || "IRT";

    if (!title) { errors.push({ row: rowNum, error: tri(lang, "عنوان ملک الزامی است", "Property title is required", "Immobilientitel ist erforderlich") }); return; }
    if (!LISTING_TYPES.includes(listingType)) { errors.push({ row: rowNum, error: tri(lang, `نوع معامله نامعتبر: ${listingType}`, `Invalid listing type: ${listingType}`, `Ungültiger Angebotstyp: ${listingType}`) }); return; }
    if (!address) { errors.push({ row: rowNum, error: tri(lang, "آدرس الزامی است", "Address is required", "Adresse ist erforderlich") }); return; }
    if (!CURRENCIES.includes(currency)) { errors.push({ row: rowNum, error: tri(lang, `واحد پولی نامعتبر: ${currency}`, `Invalid currency: ${currency}`, `Ungültige Währung: ${currency}`) }); return; }

    const price = listingType === "short_term_rent" ? 0 : Number(row.price || 0);
    const nightlyPrice = listingType === "short_term_rent" && row.nightlyPrice ? Number(row.nightlyPrice) : null;
    if (Number.isNaN(price) || Number.isNaN(nightlyPrice ?? 0)) {
      errors.push({ row: rowNum, error: tri(lang, "قیمت نامعتبر است", "Invalid price", "Ungültiger Preis") }); return;
    }

    toCreate.push({
      userId: ws.workspaceUserId,
      title,
      listingType,
      propertyType: row.propertyType?.trim() || "apartment",
      price: BigInt(Math.round(price)),
      nightlyPrice: nightlyPrice != null ? BigInt(Math.round(nightlyPrice)) : undefined,
      currency,
      bookingLink: row.bookingLink?.trim() || undefined,
      address,
      city: row.city?.trim() || undefined,
      bedrooms: row.bedrooms ? Number(row.bedrooms) : undefined,
      bathrooms: row.bathrooms ? Number(row.bathrooms) : undefined,
      areaSqm: row.areaSqm ? Number(row.areaSqm) : undefined,
      description: row.description?.trim() || undefined,
    });
  });

  let createdCount = 0;
  if (toCreate.length > 0) {
    // createMany can't be used here — BigInt fields + per-row optional
    // undefined values serialize fine individually but createMany's shared
    // column-set validation is pickier; a small per-row loop also lets a
    // single bad row fail without rolling back everything else already validated.
    for (const data of toCreate) {
      try {
        await prisma.property.create({ data: data as never });
        createdCount++;
      } catch (err) {
        console.error("property import row failed:", err);
      }
    }
  }

  return NextResponse.json({
    createdCount,
    totalRows: rows.length,
    errors,
  });
}
