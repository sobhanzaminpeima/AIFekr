import { prisma } from "@/lib/db/prisma";

/** Contact details shown on /contact in both designs. */
const DEFAULTS = {
  contact_email: "support@aifekr.com",
  contact_phone: "+905391016485",
  contact_address: "Cyprus",
  contact_telegram: "",
};

const DEFAULTS_DE = {
  contact_email: "support@aifekr.com",
  contact_phone: "+905391016485",
  contact_address: "Cyprus",
  contact_telegram: "",
};

const DEFAULTS_EN = {
  contact_email: "support@aifekr.com",
  contact_phone: "+905391016485",
  contact_address: "Cyprus",
  contact_telegram: "",
};

export async function getContactSettings(lang: string) {
  const defaults = lang === "de" ? DEFAULTS_DE : lang === "fa" ? DEFAULTS : DEFAULTS_EN;
  try {
    const rows = await prisma.siteSetting.findMany({
      where: { key: { in: ["contact_email", "contact_phone", "contact_address", "contact_telegram"] } },
    });
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;
    // The address field from the DB is Persian-authored, so only apply DB overrides in Persian mode.
    return {
      ...defaults,
      ...map,
      contact_email: "support@aifekr.com",
      contact_phone: "+905391016485",
      contact_address: "Cyprus",
    };
  } catch {
    return defaults;
  }
}
