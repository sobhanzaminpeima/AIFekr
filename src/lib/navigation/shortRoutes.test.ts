import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import nextConfig from "../../../next.config.mjs";
import { SHORT_ROUTES } from "./shortRoutes.mjs";

const appDir = path.resolve(__dirname, "../../app");

/** Route groups such as (dashboard) do not appear in the URL. */
function hasPage(dir: string, segments: string[]): boolean {
  if (!segments.length && existsSync(path.join(dir, "page.tsx"))) return true;
  const groups = readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory() && /^\(.+\)$/.test(e.name));
  if (groups.some((g) => hasPage(path.join(dir, g.name), segments))) return true;
  if (!segments.length) return false;
  const next = path.join(dir, segments[0]);
  return existsSync(next) && hasPage(next, segments.slice(1));
}

describe("short routes", () => {
  it.each(SHORT_ROUTES)("%s leads to a real page (%s)", (source, destination) => {
    expect(hasPage(appDir, destination.split("?")[0].split("/").filter(Boolean))).toBe(true);
    expect(hasPage(appDir, source.split("/").filter(Boolean))).toBe(false);
  });

  it("every short route is an active, temporary redirect", async () => {
    const redirects = await nextConfig.redirects!();
    for (const [source, destination] of SHORT_ROUTES) {
      expect(redirects).toContainEqual({ source, destination, permanent: false });
    }
  });
});
