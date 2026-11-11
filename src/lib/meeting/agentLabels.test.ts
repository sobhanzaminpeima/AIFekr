import { describe, expect, it } from "vitest";
import { agentLabels } from "./agentLabels";

describe("meeting agent labels", () => {
  it("never shows raw keys", () => {
    expect(agentLabels(["ceo", "sales"], "fa")).toBe("مدیرعامل، فروش");
    expect(agentLabels(["ceo", "sales"], "de")).toBe("CEO, Vertrieb");
    expect(agentLabels(["finance"], "tr")).toBe("Finans");
  });
  it("keeps an unknown key rather than dropping it", () => {
    expect(agentLabels(["growth"], "en")).toBe("growth");
  });
});
