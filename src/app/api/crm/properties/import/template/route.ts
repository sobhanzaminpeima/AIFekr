export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { getServerLang } from "@/lib/i18n/server";
import { toCsv } from "@/lib/utils/csv";

// Column order and keys must exactly match what POST /api/crm/properties/import
// expects — this is the single source of truth for both sides.
export const IMPORT_COLUMNS = [
  "title", "listingType", "propertyType", "price", "nightlyPrice",
  "currency", "bookingLink", "address", "city", "bedrooms", "bathrooms", "areaSqm", "description",
] as const;

const HEADER_NOTE: Record<string, string> = {
  fa: "# listingType: buy | sell | rent | short_term_rent — propertyType: apartment | villa | land | commercial — currency: IRT | IRR | USD | GBP | EUR — nightlyPrice فقط برای short_term_rent لازم است",
  en: "# listingType: buy | sell | rent | short_term_rent — propertyType: apartment | villa | land | commercial — currency: IRT | IRR | USD | GBP | EUR — nightlyPrice only applies to short_term_rent",
  de: "# listingType: buy | sell | rent | short_term_rent — propertyType: apartment | villa | land | commercial — currency: IRT | IRR | USD | GBP | EUR — nightlyPrice gilt nur für short_term_rent",
};

const SAMPLE_ROWS: Record<string, string[][]> = {
  fa: [
    ["آپارتمان ۲ خوابه سعادت‌آباد", "sell", "apartment", "8500000000", "", "IRT", "", "خیابان سرو غربی، پلاک ۱۲", "تهران", "2", "1", "110", "بازسازی‌شده، طبقه سوم"],
    ["ویلای اجاره روزانه شمال", "short_term_rent", "villa", "", "3500000", "IRT", "https://www.airbnb.com/rooms/example", "جاده هراز، کیلومتر ۱۵", "آمل", "3", "2", "200", "استخر و باربیکیو"],
  ],
  en: [
    ["2-bed apartment, Saadat Abad", "sell", "apartment", "8500000000", "", "IRT", "", "West Sarv St, No. 12", "Tehran", "2", "1", "110", "Renovated, 3rd floor"],
    ["North villa, short-term rental", "short_term_rent", "villa", "", "3500000", "IRT", "https://www.airbnb.com/rooms/example", "Haraz Road, km 15", "Amol", "3", "2", "200", "Pool and BBQ area"],
  ],
  de: [
    ["2-Zimmer-Wohnung, Saadat Abad", "sell", "apartment", "8500000000", "", "IRT", "", "West-Sarv-Straße, Nr. 12", "Teheran", "2", "1", "110", "Renoviert, 3. Stock"],
    ["Nordvilla, Kurzzeitvermietung", "short_term_rent", "villa", "", "3500000", "IRT", "https://www.airbnb.com/rooms/example", "Haraz-Straße, km 15", "Amol", "3", "2", "200", "Pool und Grillbereich"],
  ],
};

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse();
  const lang = await getServerLang();

  const csv = `${HEADER_NOTE[lang]}\r\n${toCsv([[...IMPORT_COLUMNS], ...SAMPLE_ROWS[lang]])}`;
  // Leading BOM so Excel opens UTF-8 (Persian/German text) correctly instead of mojibake.
  const body = "﻿" + csv;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="properties-import-template.csv"`,
    },
  });
}
