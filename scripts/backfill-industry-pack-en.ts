// One-time backfill: translates existing IndustryPack Persian content into
// the *_en columns (added in migration 20260816_add_industry_pack_en_fields)
// using the platform's own AI router. Safe to re-run — skips packs that
// already have valuePropositionEn set.
//
// Run on the server after `npx prisma migrate deploy`:
//   npx ts-node --compiler-options '{"module":"commonjs"}' scripts/backfill-industry-pack-en.ts
import { PrismaClient } from "@prisma/client";
import { routedStreamChat } from "../src/lib/ai/router";

const prisma = new PrismaClient();

const SYSTEM = `You translate Persian SaaS marketing/product copy into natural, professional English.
You will receive a JSON object with several Persian fields. Return ONLY a JSON object with the
same keys, translated to English, preserving any nested JSON structure (arrays/objects) exactly
as given. Do not add commentary, markdown fences, or extra keys.`;

async function translate(input: Record<string, unknown>): Promise<Record<string, string>> {
  let output = "";
  await routedStreamChat(
    [{ role: "user", content: JSON.stringify(input) }],
    SYSTEM,
    (text) => { output += text; },
    () => {},
    undefined,
    undefined,
    4096
  );
  const match = output.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON in translation output: " + output.slice(0, 200));
  return JSON.parse(match[0]);
}

async function main() {
  const packs = await prisma.industryPack.findMany({ where: { valuePropositionEn: null } });
  console.log(`Found ${packs.length} pack(s) needing English translation.`);

  for (const pack of packs) {
    console.log(`Translating: ${pack.slug}`);
    try {
      const translated = await translate({
        name: pack.name,
        tagline: pack.tagline,
        valueProposition: pack.valueProposition,
        targetCustomers: pack.targetCustomers,
        painPoints: pack.painPoints,
        agents: pack.agents,
        outcomes: pack.outcomes,
        kpis: pack.kpis,
      });

      await prisma.industryPack.update({
        where: { id: pack.id },
        data: {
          nameEn: pack.nameEn ?? translated.name,
          taglineEn: pack.taglineEn ?? translated.tagline,
          valuePropositionEn: translated.valueProposition,
          targetCustomersEn: translated.targetCustomers,
          painPointsEn: translated.painPoints,
          agentsEn: translated.agents,
          outcomesEn: translated.outcomes,
          kpisEn: translated.kpis,
        },
      });
      console.log(`  done.`);
    } catch (err) {
      console.error(`  FAILED for ${pack.slug}:`, err);
    }
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
