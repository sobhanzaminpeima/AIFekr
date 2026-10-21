import {describe,it,expect} from "vitest";
import {commercialSchema,commercialEstimate} from "./economics";
import {configurationSchema,policySchema,quote} from "./domain";
describe("Independent Video Factory draft price book",()=>{
 const book=commercialSchema.parse({mode:"DURATION_RETAIL",creditRate:{planCode:"PRO_USD",usdCents:4900,credits:2000}});
 it("converts the current explicit platform rate with conservative integer rounding",()=>{expect(commercialEstimate(book,600)).toMatchObject({saleCents:5900,estimatedCostCents:2500,grossProfitCents:3400,grossMarginPercent:57.63,markupPercent:136,credits:2409,status:"DRAFT",estimated:true});expect(commercialEstimate(book,300)).toMatchObject({saleCents:2950,estimatedCostCents:1250,credits:1205});expect(commercialEstimate(book,3600).credits).toBe(14449);});
 it("does not fabricate a conversion when the package is missing",()=>{expect(commercialEstimate({...book,creditRate:null},600).credits).toBeNull();});
 it("quotes a duration package without changing other service rates",()=>{const c=configurationSchema.parse({durationSeconds:600,language:"fa",ratio:"16:9",quality:"SMART",mode:"AUTOPILOT",budgetCap:10000}),p=policySchema.parse({enabled:true,longFormEnabled:true,creditsPerChapter:3,creditsPerRenderMinute:2,commercial:book});const q=quote(c,p);expect(q.credits).toBe(2409);expect(q.items.reduce((n,i)=>n+i.credits,0)).toBe(2409);expect(p.creditsPerChapter).toBe(3);expect(q.commercial?.estimated).toBe(true);});
});
