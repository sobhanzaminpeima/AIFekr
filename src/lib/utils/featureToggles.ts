import { prisma } from "@/lib/db/prisma";

/**
 * Site-wide feature kill switches — lets an admin instantly turn off a
 * generation tool platform-wide (e.g. during a provider outage or to stop
 * cost overrun) without a deploy. Backed by the generic SiteSetting
 * key/value table (see src/app/api/admin/settings/route.ts), one row per
 * feature: "feature_image_enabled" | "feature_video_enabled" |
 * "feature_music_enabled", value "true"/"false". Missing row = enabled
 * (fail-open, matches every other SiteSetting default in admin/settings).
 */

export type ToggleableFeature = "image" | "video" | "music";

const SETTING_KEY: Record<ToggleableFeature, string> = {
  image: "feature_image_enabled",
  video: "feature_video_enabled",
  music: "feature_music_enabled",
};

export const FEATURE_DISABLED_MESSAGE: Record<ToggleableFeature, string> = {
  image: "ساخت تصویر موقتاً توسط مدیریت غیرفعال شده است.",
  video: "ساخت ویدیو موقتاً توسط مدیریت غیرفعال شده است.",
  music: "ساخت موزیک موقتاً توسط مدیریت غیرفعال شده است.",
};

export async function isFeatureEnabled(feature: ToggleableFeature): Promise<boolean> {
  const row = await prisma.siteSetting.findUnique({ where: { key: SETTING_KEY[feature] } });
  return row?.value !== "false";
}

/** All three flags at once — used by the public status endpoint the generate pages poll. */
export async function getAllFeatureToggles(): Promise<Record<ToggleableFeature, boolean>> {
  const rows = await prisma.siteSetting.findMany({
    where: { key: { in: Object.values(SETTING_KEY) } },
  });
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  return {
    image: byKey.get(SETTING_KEY.image) !== "false",
    video: byKey.get(SETTING_KEY.video) !== "false",
    music: byKey.get(SETTING_KEY.music) !== "false",
  };
}
