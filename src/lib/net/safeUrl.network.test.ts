import { describe, it, expect } from "vitest";
import { safeFetch } from "./safeUrl";
describe.skipIf(process.env.RUN_SEO_PUBLIC_NETWORK !== "1")("public network transport", () => {
  it("fetches the authorized public AIFekr website using pinned DNS", async () => {
    const response = await safeFetch("https://aifekr.com/", { signal: AbortSignal.timeout(20000) });
    expect(response.status).toBe(200);
    expect((await response.text()).toLowerCase()).toContain("aifekr");
  }, 25000);
});
