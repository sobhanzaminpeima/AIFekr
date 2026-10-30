import { existsSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { PLATFORM_TOOLS, platformGuide } from "./platformGuide";

const app = join(__dirname, "../../app");
const pageExists = (path: string) =>
  ["", "(dashboard)", "(dashboard)/(business)"].some((group) => existsSync(join(app, group, path, "page.tsx")));

it("only points to pages that exist", () => {
  expect(PLATFORM_TOOLS.filter((t) => !pageExists(t.path)).map((t) => t.path)).toEqual([]);
});
it("tells the chat it cannot operate the tools or promise access", () => {
  expect(platformGuide()).toContain("cannot open or operate");
  expect(platformGuide()).toContain("https://aifekr.com/crm");
});
