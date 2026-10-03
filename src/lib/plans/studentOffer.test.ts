import { describe, it, expect } from "vitest";
import { STUDENT_OFFER, studentOfferCopy, studentOfferPrices } from "./studentOffer";
describe("USD student offer", () => {
 it("prices the existing two-month introductory package at 80 USD", () => { expect(STUDENT_OFFER.usdPrice).toBe(80); expect(STUDENT_OFFER.months).toBe(2); });
 it("converts USD cents to Toman and TRY with supplied daily rates", () => { expect(studentOfferPrices(163399.625272, 49.123297)).toEqual({ usdCents: 8000, toman: 13071970, lira: 3929.86 }); });
 it("provides four complete translations", () => { for (const lang of ["fa","en","de","tr"] as const) expect(studentOfferCopy[lang].features).toHaveLength(8); });
});
