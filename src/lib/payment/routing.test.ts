import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ user: vi.fn(), zarinpal: vi.fn(), bank: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { user: { findUnique: m.user } } }));
vi.mock("./zarinpal", () => ({ zarinpalConfigured: m.zarinpal }));
vi.mock("./bank", () => ({ bankSettings: m.bank, validIban: (v: string) => /^TR\d{24}$/.test(v) }));
import { allowedCurrency, paymentOptions } from "./routing";

const IBAN = "TR210001009010583132105001", EUR = "TR910001009010583132105002";
beforeEach(() => {
  m.zarinpal.mockResolvedValue(true);
  m.bank.mockResolvedValue({ iban: IBAN, euroIban: EUR });
});
const currencies = (r: { options: { currency: string }[] }) => r.options.map((o) => o.currency);

describe("payment routing", () => {
  it("Persian or Iranian accounts get Zarinpal toman first, with the bank-transfer currencies", async () => {
    m.user.mockResolvedValue({ country: "IR", language: "fa" });
    const r = await paymentOptions("u", "fa");
    expect(currencies(r)).toEqual(["IRT", "TRY", "EUR", "USD"]);
    expect(r.preferred).toBe("IRT");
  });
  it("a Turkish visitor gets lira by bank transfer, never Zarinpal", async () => {
    m.user.mockResolvedValue({ country: "TR", language: "tr" });
    const r = await paymentOptions("u", "tr");
    expect(currencies(r)).not.toContain("IRT");
    expect(r.preferred).toBe("TRY");
  });
  it("switching the site to Persian does not open Zarinpal for a non-Iranian, non-Persian account", async () => {
    m.user.mockResolvedValue({ country: "DE", language: "de" });
    // Site language alone (fa) is not enough: the account is German.
    const r = await paymentOptions("u", "de");
    expect(currencies(r)).not.toContain("IRT");
    expect(r.preferred).toBe("USD");
  });
  it("an Iranian account browsing in Turkish keeps toman available but prefers its country's route", async () => {
    m.user.mockResolvedValue({ country: "IR", language: "fa" });
    const r = await paymentOptions("u", "tr");
    expect(currencies(r)).toContain("IRT");
    expect(r.preferred).toBe("IRT");
  });
  it("no IBAN and no merchant leaves no route (the page shows a clear message instead of a broken checkout)", async () => {
    m.user.mockResolvedValue({ country: "TR", language: "tr" });
    m.zarinpal.mockResolvedValue(false);
    m.bank.mockResolvedValue({ iban: "", euroIban: "" });
    expect(await paymentOptions("u", "tr")).toEqual({ options: [], preferred: null });
  });
  it("checkout's IRR means toman", () => {
    expect(allowedCurrency([{ currency: "IRT", gateway: "zarinpal" }], "IRR")).toBe(true);
    expect(allowedCurrency([{ currency: "TRY", gateway: "bank_transfer" }], "IRR")).toBe(false);
  });
});
