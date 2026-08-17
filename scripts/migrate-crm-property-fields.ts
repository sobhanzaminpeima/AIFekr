/**
 * One-off data migration: moves the real-estate CrmDeal.customFields JSON
 * blob (propertyType/area/dealType/address — see src/lib/crm/industryTemplates.ts)
 * into a proper Property row linked via crmDealId/crmContactId, so CRM can
 * filter/search on real columns instead of parsing JSON, and a Property
 * created from a voice-agent call shares the same table a CRM deal points to.
 *
 * Scope: only CrmDeal rows on a pipeline with industrySlug === "real-estate"
 * and non-null customFields — never touches other industries' JSON blobs.
 *
 * Safety: read-only by default (--apply required to write). Idempotent —
 * skips any deal that already has a linked Property. Never deletes or
 * modifies customFields or the source deal; the JSON blob is left in place
 * as a fallback/audit trail. Any row that can't be cleanly converted is
 * logged and skipped, never fails the whole run.
 *
 * Usage:
 *   npx tsx scripts/migrate-crm-property-fields.ts            # dry run, report only
 *   npx tsx scripts/migrate-crm-property-fields.ts --apply    # actually create rows
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const PROPERTY_TYPE_MAP: Record<string, string> = {
  "آپارتمان": "apartment",
  "ویلا": "villa",
  "زمین": "land",
  "تجاری": "commercial",
};

const DEAL_TYPE_TO_LISTING: Record<string, string> = {
  "فروش": "sell",
  "اجاره": "rent",
  "رهن": "rent",
};

interface SkipRecord {
  dealId: string;
  reason: string;
  customFields: string | null;
}

async function main() {
  const deals = await prisma.crmDeal.findMany({
    where: {
      customFields: { not: null },
      pipeline: { industrySlug: "real-estate" },
    },
    select: {
      id: true,
      userId: true,
      contactId: true,
      title: true,
      value: true,
      customFields: true,
    },
  });

  console.log(`Found ${deals.length} real-estate deal(s) with customFields.`);

  const skipped: SkipRecord[] = [];
  let created = 0;
  let alreadyLinked = 0;

  for (const deal of deals) {
    const existing = await prisma.property.findFirst({ where: { crmDealId: deal.id } });
    if (existing) {
      alreadyLinked++;
      continue;
    }

    let fields: Record<string, unknown>;
    try {
      fields = JSON.parse(deal.customFields!);
    } catch {
      skipped.push({ dealId: deal.id, reason: "customFields is not valid JSON", customFields: deal.customFields });
      continue;
    }

    const address = typeof fields.address === "string" ? fields.address.trim() : "";
    const rawPropertyType = typeof fields.propertyType === "string" ? fields.propertyType.trim() : "";
    const rawDealType = typeof fields.dealType === "string" ? fields.dealType.trim() : "";
    const rawArea = fields.area;

    if (!address) {
      skipped.push({ dealId: deal.id, reason: "missing address", customFields: deal.customFields });
      continue;
    }
    if (!rawPropertyType) {
      skipped.push({ dealId: deal.id, reason: "missing propertyType", customFields: deal.customFields });
      continue;
    }
    const listingType = DEAL_TYPE_TO_LISTING[rawDealType];
    if (!listingType) {
      skipped.push({ dealId: deal.id, reason: `missing or unrecognized dealType: "${rawDealType}"`, customFields: deal.customFields });
      continue;
    }
    if (!(deal.value > 0)) {
      skipped.push({ dealId: deal.id, reason: `deal.value is not a valid price (${deal.value})`, customFields: deal.customFields });
      continue;
    }

    const propertyType = PROPERTY_TYPE_MAP[rawPropertyType] || rawPropertyType;
    const areaSqm = typeof rawArea === "number" ? rawArea : typeof rawArea === "string" && rawArea.trim() && !isNaN(Number(rawArea)) ? Number(rawArea) : undefined;

    if (APPLY) {
      await prisma.property.create({
        data: {
          userId: deal.userId,
          crmContactId: deal.contactId,
          crmDealId: deal.id,
          title: deal.title,
          listingType,
          propertyType,
          price: BigInt(Math.round(deal.value)),
          address,
          areaSqm,
          status: "available",
        },
      });
    }
    created++;
  }

  console.log(`\n${APPLY ? "Created" : "Would create"}: ${created}`);
  console.log(`Already linked (skipped as duplicate): ${alreadyLinked}`);
  console.log(`Skipped (needs manual review): ${skipped.length}`);
  if (skipped.length) {
    console.log("\n--- Skipped records ---");
    for (const s of skipped) {
      console.log(`  dealId=${s.dealId} reason="${s.reason}" customFields=${s.customFields}`);
    }
  }
  if (!APPLY && created > 0) {
    console.log("\nDry run only — re-run with --apply to write these rows.");
  }
}

main()
  .catch((err) => {
    console.error("Migration script failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
