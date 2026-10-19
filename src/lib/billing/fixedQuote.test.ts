import {vi,it,expect} from "vitest";
vi.mock("@/lib/db/prisma",()=>({prisma:{package:{findUniqueOrThrow:async()=>({planCode:"FIXED_TEST",isActive:true,publicationStatus:"PUBLISHED",publicVisible:true,category:"PERSONAL",price:0,duration:30,baseCurrency:"USD",termPrices:'{"monthly":6999}',entitlements:JSON.stringify({fixedPrices:{TRY:{monthly:350000},IRT:{monthly:7000000}}}),credits:7000,promoEligible:false})},payment:{findFirst:async()=>null},billingQuote:{create:async({data}:{data:unknown})=>data}}}));
vi.mock("./rates",()=>({currencyConvert:vi.fn(async()=>{throw Error("EXPIRED_FX_MUST_NOT_BE_USED");})}));
vi.mock("@/lib/utils/referralPromo",()=>({referralDiscount:async()=>({percent:10,code:"TEST"})}));
import {createQuote} from "./quotes";
import {currencyConvert} from "./rates";
it("checkout locks the published local price and accounting amount without live or expired FX",async()=>{const q=await createQuote("test","FIXED_TEST","monthly","TRY");expect(q).toMatchObject({amountMinor:315000,amountToman:6300000});expect(JSON.parse(q.snapshot).originalAmountToman).toBe(7000000);expect(currencyConvert).not.toHaveBeenCalled();});
