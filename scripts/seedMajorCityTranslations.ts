import { prisma } from "../src/lib/db/prisma";
import fs from "fs";
import path from "path";

/**
 * Applies fa/de translations to a curated list of ~100 major/well-known
 * cities (prisma/seed-data/majorCityTranslations.json) — not all ~153k
 * seeded cities, since machine-translating every obscure town isn't
 * reliable. Idempotent: always overwrites with the current curated file,
 * safe to re-run after editing the JSON.
 */

interface Translation { iso2: string; name: string; fa: string; de: string; }

async function main() {
  const filePath = path.join(__dirname, "..", "prisma", "seed-data", "majorCityTranslations.json");
  const translations: Translation[] = JSON.parse(fs.readFileSync(filePath, "utf8"));

  let updated = 0;
  let missing = 0;
  for (const t of translations) {
    const country = await prisma.country.findUnique({ where: { iso2: t.iso2 } });
    if (!country) { console.log(`MISSING country: ${t.iso2}`); missing++; continue; }

    const result = await prisma.city.updateMany({
      where: { countryId: country.id, name: t.name },
      data: { nameFa: t.fa, nameDe: t.de },
    });
    if (result.count === 0) { console.log(`MISSING city: ${t.iso2} / ${t.name}`); missing++; }
    else updated += result.count;
  }

  console.log(`Done. Updated ${updated} cities, ${missing} not found.`);
}

main().finally(() => prisma.$disconnect());
