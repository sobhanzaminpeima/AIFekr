import { describe, it, expect } from "vitest";
import { STUDENT_OFFER, studentOfferCopy, studentOfferPrices } from "./studentOffer";
describe("USD student offer", () => {
 it("offers three months for 80 USD with a 240 USD reference price", () => { expect(STUDENT_OFFER).toEqual({usdPrice:80,originalUsdPrice:240,months:3,days:90}); });
 it("converts USD cents to Toman and TRY with supplied daily rates", () => { expect(studentOfferPrices(163399.625272, 49.123297)).toEqual({ usdCents: 8000, toman: 13071970, lira: 3929.86 }); });
 it("provides four complete translations", () => { for (const lang of ["fa","en","de","tr"] as const) expect(studentOfferCopy[lang].features).toHaveLength(8); });
});
