// Applies the curated English IndustryPack copy in prisma/data/industry-packs-en.json
// to the *_en columns.
//
// Why this exists alongside backfill-industry-pack-en.ts: that script asks the
// AI router to translate, and it had never actually been run against
// production — all 8 packs were sitting with 6 of their 8 English fields
// empty, so English and German visitors read the Persian body copy on every
// industry page. This one applies human-reviewed marketing copy instead,
// which is the right call for brand-facing text.
//
// Agent slug/role/icon are carried over from the live Persian rows; only the
// name and description are replaced, so the structure the page renders is
// untouched. Persian columns are never written.
//
//   DATABASE_URL="file:./prisma/prisma/prod.db" \
//     npx tsx scripts/apply-industry-pack-en.ts
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();

interface Agent { slug: string; name: string; role: string; description: string; icon: string }
interface PackTranslation {
  valueProposition: string;
  targetCustomers: string[];
  painPoints: string[];
  kpis: string[];
  outcomes: { metric: string; description: string }[];
  agents: Record<string, [string, string]>;
}

async function main() {
  const file = path.join(process.cwd(), "prisma", "data", "industry-packs-en.json");
  const translations: Record<string, PackTranslation> = JSON.parse(fs.readFileSync(file, "utf8"));

  const packs = await prisma.industryPack.findMany({ select: { slug: true, agents: true } });
  let updated = 0;
  const skipped: string[] = [];

  for (const pack of packs) {
    const t = translations[pack.slug];
    if (!t) { skipped.push(pack.slug); continue; }

    const faAgents: Agent[] = JSON.parse(pack.agents);
    const agentsEn = faAgents.map((a) => {
      const tr = t.agents[a.slug];
      if (!tr) throw new Error(`${pack.slug}: no translation for agent "${a.slug}"`);
      return { ...a, name: tr[0], description: tr[1] };
    });

    await prisma.industryPack.update({
      where: { slug: pack.slug },
      data: {
        valuePropositionEn: t.valueProposition,
        targetCustomersEn: JSON.stringify(t.targetCustomers),
        painPointsEn: JSON.stringify(t.painPoints),
        agentsEn: JSON.stringify(agentsEn),
        outcomesEn: JSON.stringify(t.outcomes),
        kpisEn: JSON.stringify(t.kpis),
      },
    });
    updated++;
  }

  console.log(`updated ${updated} pack(s)`);
  if (skipped.length) console.log(`no translation on file for: ${skipped.join(", ")}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
