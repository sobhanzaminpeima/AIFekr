import {it,expect} from "vitest";
import {fixedPackagePrice,packageDisplayPrice} from "./fixedPrices";
const p={baseCurrency:"USD",termPrices:'{"monthly":6999}',entitlements:JSON.stringify({fixedPrices:{IRT:{monthly:7000000},TRY:{monthly:349999}}})};
it("uses identical fixed prices without depending on an exchange-rate source",()=>{expect(fixedPackagePrice(p,"monthly","IRT")).toBe(7000000);expect(fixedPackagePrice(p,"monthly","TRY")).toBe(349999);expect(fixedPackagePrice(p,"monthly","USD")).toBe(6999);});
it("shows an explicit base price when a local fixed price is not configured",()=>{expect(packageDisplayPrice(p,"monthly","EUR",6999,"USD")).toEqual({minor:6999,currency:"USD"});expect(fixedPackagePrice(p,"annual","TRY")).toBeNull();});
it("editing the canonical base term cannot leave a stale duplicate price visible",()=>{expect(fixedPackagePrice({...p,termPrices:'{"monthly":7999}'} ,"monthly","USD")).toBe(7999);});
