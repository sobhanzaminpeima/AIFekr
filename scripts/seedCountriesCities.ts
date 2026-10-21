import { prisma } from "../src/lib/db/prisma";
import fs from "fs";
import path from "path";

/**
 * One-time load of prisma/seed-data/countries-cities.json into the
 * Country/City tables (structure created by migration
 * 20260824_countries_cities). Idempotent — safe to re-run: countries are
 * upserted by iso2, and a country's cities are only inserted if it
 * currently has none (so re-running never duplicates ~153k rows).
 */

interface SeedCountry {
  iso2: string;
  name: string;
  nameFa: string | null;
  nameDe: string | null;
  emoji: string | null;
  cities: string[];
}

const CHUNK_SIZE = 2000;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  const filePath = path.join(__dirname, "..", "prisma", "seed-data", "countries-cities.json");
  const countries: SeedCountry[] = JSON.parse(fs.readFileSync(filePath, "utf8"));

  console.log(`Seeding ${countries.length} countries...`);
  let totalCities = 0;

  for (const c of countries) {
    const country = await prisma.country.upsert({
      where: { iso2: c.iso2 },
      create: { iso2: c.iso2, name: c.name, nameFa: c.nameFa, nameDe: c.nameDe, emoji: c.emoji },
      update: { name: c.name, nameFa: c.nameFa, nameDe: c.nameDe, emoji: c.emoji },
    });

    const existingCityCount = await prisma.city.count({ where: { countryId: country.id } });
    if (existingCityCount > 0) continue; // already seeded this country's cities

    const uniqueCities = Array.from(new Set(c.cities)).filter(Boolean);
    for (const batch of chunk(uniqueCities, CHUNK_SIZE)) {
      await prisma.city.createMany({
        data: batch.map((name) => ({ countryId: country.id, name })),
      });
    }
    totalCities += uniqueCities.length;
    if (uniqueCities.length > 0) console.log(`  ${c.name}: ${uniqueCities.length} cities`);
  }

  console.log(`Done. Inserted ${totalCities} new cities.`);
}

main().finally(() => prisma.$disconnect());
