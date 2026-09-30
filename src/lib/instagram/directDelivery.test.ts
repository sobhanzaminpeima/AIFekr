import { describe, expect, it } from "vitest";
import { chooseDirectDelaySeconds, MAX_DIRECT_DELAY_SECONDS, parseDirectDeliveryOptions } from "./directDelivery";

describe("Instagram Auto Direct delivery options", () => {
  it("uses safe defaults and parses supported options", () => {
    expect(parseDirectDeliveryOptions({})).toEqual({
      followGateEnabled: false,
      typingIndicatorEnabled: false,
      delayMinSeconds: 0,
      delayMaxSeconds: 0,
    });
    expect(parseDirectDeliveryOptions({ followGateEnabled: true, typingIndicatorEnabled: true, delayMinSeconds: 1, delayMaxSeconds: 4 }))
      .toEqual({ followGateEnabled: true, typingIndicatorEnabled: true, delayMinSeconds: 1, delayMaxSeconds: 4 });
  });

  it("rejects invalid, excessive, and inverted delay ranges", () => {
    expect(parseDirectDeliveryOptions({ delayMinSeconds: -1, delayMaxSeconds: 1 })).toBeNull();
    expect(parseDirectDeliveryOptions({ delayMinSeconds: 2, delayMaxSeconds: 1 })).toBeNull();
    expect(parseDirectDeliveryOptions({ delayMinSeconds: 0, delayMaxSeconds: MAX_DIRECT_DELAY_SECONDS + 1 })).toBeNull();
    expect(parseDirectDeliveryOptions({ followGateEnabled: "true" })).toBeNull();
  });

  it("chooses an inclusive delay in the configured range", () => {
    expect(chooseDirectDelaySeconds(1, 3, () => 0)).toBe(1);
    expect(chooseDirectDelaySeconds(1, 3, () => 0.999999)).toBe(3);
    expect(chooseDirectDelaySeconds(2, 2, () => 0.5)).toBe(2);
  });
});
