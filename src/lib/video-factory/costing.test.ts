import {describe,it,expect} from "vitest";
import {productionCost,defaultRateCard,rateCardSchema} from "./costing";
import {commercialEstimate,detailedCommercialSchema} from "./economics";
describe("Supplier cost and gross margin",()=>{
 it("includes provider use, retry allowance, infrastructure and payment fees",()=>{const c=productionCost(defaultRateCard,1);expect(c.supplierUsd).toBeCloseTo(1.0504);expect(c.platformUsd).toBeCloseTo(0.3);expect(c.grossMarginPercent).toBeGreaterThanOrEqual(50);expect(c.minimumSaleCents).toBeGreaterThan(300);});
 it("distinguishes 50% gross margin from 50% markup",()=>{const c=productionCost({...defaultRateCard,paymentFeePercent:0,paymentFixedUsd:0},1);expect(c.minimumSaleCents).toBe(c.costCents*2);});
 it("rejects invalid and duplicate tariffs",()=>{expect(()=>rateCardSchema.parse({...defaultRateCard,minimumMarginPercent:49})).toThrow();expect(()=>rateCardSchema.parse({...defaultRateCard,rates:[defaultRateCard.rates[0],defaultRateCard.rates[0]]})).toThrow();expect(()=>productionCost(defaultRateCard,NaN)).toThrow();});
 it("all revised packages clear the margin floor at full minute usage",()=>{for(const [minutes,price] of [[18,6999],[48,16999],[90,31999]])expect(productionCost(defaultRateCard,minutes,price).grossMarginPercent).toBeGreaterThanOrEqual(50);});
 it("reprices expensive configured clips and shorts instead of subsidizing them",()=>{const b=detailedCommercialSchema.parse({baseSeconds:60,saleCents:311,rateCard:{...defaultRateCard,rates:[...defaultRateCard.rates,{id:"video",model:"optional-admin-model",unit:"second",usd:0.08,quantityPerMinute:0,source:"https://ai.google.dev/gemini-api/docs/pricing"}]}});const smart=commercialEstimate(b,480),film=commercialEstimate(b,480,"FILM_STUDIO"),short=commercialEstimate(b,15);expect(film.saleCents).toBeGreaterThan(smart.saleCents);expect(film.grossMarginPercent).toBeGreaterThanOrEqual(50);expect(short.grossMarginPercent).toBeGreaterThanOrEqual(50);});
});
