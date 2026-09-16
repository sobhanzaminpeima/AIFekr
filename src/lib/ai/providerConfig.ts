import fs from "fs";
import path from "path";
import { prisma } from "@/lib/db/prisma";

/**
 * Admin on/off switches for chat providers.
 *
 * These used to live only in src/lib/ai/provider-config.json, written to disk
 * by the admin page. That file is part of the source tree, so any deploy that
 * shipped it silently reset every admin toggle. The source of truth is now
 * the `ai_disabled_providers` SiteSetting; the JSON file is only the default
 * used until an admin saves once.
 *
 * The router picks a provider synchronously, so reads come from an in-memory
 * cache refreshed from the database in the background (stale-while-
 * revalidate). Admin writes update the cache immediately, so a toggle takes
 * effect on the next request on this instance.
 */

const SETTING_KEY = "ai_disabled_providers";
const CACHE_TTL_MS = 30_000;
const SEED_PATH = path.join(process.cwd(), "src/lib/ai/provider-config.json");

function readSeed(): string[] {
  try {
    const cfg = JSON.parse(fs.readFileSync(SEED_PATH, "utf-8"));
    return Array.isArray(cfg.disabled) ? cfg.disabled : [];
  } catch {
    return [];
  }
}

let cache: Set<string> = new Set(readSeed());
let loadedAt = 0;
let inflight: Promise<void> | null = null;

async function loadFromDb(): Promise<void> {
  try {
    const row = await prisma.siteSetting.findUnique({ where: { key: SETTING_KEY } });
    if (row) {
      const parsed = JSON.parse(row.value);
      if (Array.isArray(parsed)) cache = new Set(parsed.filter((v): v is string => typeof v === "string"));
    }
    loadedAt = Date.now();
  } catch (err) {
    // Keep serving the last known set; a DB blip must never enable providers
    // an admin switched off, or disable every provider at once.
    console.error("provider config refresh failed:", err);
  }
}

/** Forces a fresh read. Use in async entry points that must not see stale data. */
export async function refreshDisabledProviders(): Promise<void> {
  if (!inflight) inflight = loadFromDb().finally(() => { inflight = null; });
  await inflight;
}

/** Synchronous read for the router; kicks off a background refresh when stale. */
export function getDisabledProviders(): Set<string> {
  if (Date.now() - loadedAt > CACHE_TTL_MS) void refreshDisabledProviders();
  return cache;
}

export async function setProviderEnabled(providerId: string, enabled: boolean): Promise<string[]> {
  await refreshDisabledProviders();
  const next = new Set(cache);
  if (enabled) next.delete(providerId);
  else next.add(providerId);

  const value = JSON.stringify(Array.from(next));
  await prisma.siteSetting.upsert({
    where: { key: SETTING_KEY },
    create: { key: SETTING_KEY, value },
    update: { value },
  });
  cache = next;
  loadedAt = Date.now();
  return Array.from(next);
}
