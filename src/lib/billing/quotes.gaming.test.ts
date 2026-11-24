import { beforeEach, describe, expect, it, vi } from "vitest";
const m=vi.hoisted(()=>({pkg:vi.fn(),quote:vi.fn()}));
vi.mock("@/lib/db/prisma",()=>({prisma:{package:{findUniqueOrThrow:m.pkg},payment:{findFirst:async()=>null},billingQuote:{create:m.quote}}}));
vi.mock("@/lib/utils/referralPromo",()=>({referralDiscount:async()=>({percent:0,code:null})}));
vi.mock("./rates",()=>({currencyConvert:async(minor:number,from:string,to:string)=>{if(from!==to)throw Error("UNEXPECTED_FX");return{minor,rates:[]};}}));
import {createQuote} from "./quotes";
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv("VIDEO_FACTORY_SALES_APPROVED","true");m.quote.mockImplementation(async({data})=>data);m.pkg.mockResolvedValue({planCode:"GAMING_SHORTS_3",category:"VIDEO_FACTORY",isActive:true,publicVisible:true,publicationStatus:"PUBLISHED",studentEligibility:"ACCOUNT_TYPE",duration:30,baseCurrency:"IRT",termPrices:'{"monthly":690000}',entitlements:JSON.stringify({modules:["video-factory"],limits:{gamingShorts:3,inputMaxSeconds:1800,inputMaxBytes:500000000}}),credits:0,mediaCredits:0,voiceMinutes:0,promoEligible:false,price:6900000});});
describe("Gaming Shorts checkout quote",()=>{
 it("quotes exactly 690000 toman without automatic video limits or FX",async()=>{const q=await createQuote("buyer","GAMING_SHORTS_3","monthly","IRT");expect(q.amountMinor).toBe(690000);expect(q.amountToman).toBe(690000);expect(JSON.parse(q.snapshot)).toMatchObject({credits:0,days:30,entitlements:{limits:{gamingShorts:3}}});});
 it("keeps the sales approval gate",async()=>{vi.stubEnv("VIDEO_FACTORY_SALES_APPROVED","false");await expect(createQuote("buyer","GAMING_SHORTS_3","monthly","IRT")).rejects.toThrow("OWNER_SALES_APPROVAL_REQUIRED");});
 it("does not accept malformed gaming entitlements",async()=>{const p=await m.pkg();m.pkg.mockResolvedValue({...p,entitlements:'{"limits":{"gamingShorts":9}}'});await expect(createQuote("buyer","GAMING_SHORTS_3","monthly","IRT")).rejects.toThrow();});
});
