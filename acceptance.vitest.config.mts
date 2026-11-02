import {defineConfig} from "vitest/config";
import path from "node:path";
export default defineConfig({
  cacheDir: ".acceptance-cache",
  test: {environment:"node", include:["src/components/billing/DynamicPlans.test.ts","src/lib/billing/fixedPrices.test.ts"]},
  resolve:{alias:{"@":path.resolve(import.meta.dirname,"src")}},
});
