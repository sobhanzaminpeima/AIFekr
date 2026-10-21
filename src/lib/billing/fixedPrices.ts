export type FixedPricePlan={entitlements?:string|{fixedPrices?:Record<string,Record<string,number>>};termPrices?:string;baseCurrency?:string;priceUsd?:number|null;priceTry?:number|null;price?:number};
/** Published amounts are currency-specific retail prices, never live exchange-rate conversions. */
export function fixedPackagePrice(plan:FixedPricePlan,period:string,currency:string):number|null{
 try{const terms=JSON.parse(plan.termPrices||"{}");if(plan.baseCurrency===currency&&Number.isSafeInteger(terms[period])&&terms[period]>0)return terms[period];
 const e=typeof plan.entitlements==="string"?JSON.parse(plan.entitlements):plan.entitlements;const amount=e?.fixedPrices?.[currency]?.[period];if(Number.isSafeInteger(amount)&&amount>0)return amount;
 }catch{return null;}return null;
}
export function packageDisplayPrice(plan:FixedPricePlan,period:string,currency:string,baseMinor:number,baseCurrency:string){const fixed=fixedPackagePrice(plan,period,currency);return fixed!==null?{minor:fixed,currency}:{minor:baseMinor,currency:baseCurrency};}
