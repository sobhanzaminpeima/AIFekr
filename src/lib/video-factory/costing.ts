import {z} from "zod";
import defaults from "./rate-card.json";

export const rateCardSchema=z.object({
 checkedAt:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),billingRoute:z.enum(["DIRECT","RESELLER"]),
 minimumMarginPercent:z.number().min(50).max(95),paymentFeePercent:z.number().min(0).max(20),paymentFixedUsd:z.number().min(0).max(100),
 retryReservePercent:z.number().min(0).max(200),platformUsdPerMinute:z.number().min(0).max(100),remotionUsdPerMinute:z.number().min(0).max(100),infrastructureMeasured:z.boolean(),
 rates:z.array(z.object({id:z.string().min(1).max(80),model:z.string().min(1).max(100),unit:z.string().min(1).max(80),usd:z.number().finite().min(0).max(1000),quantityPerMinute:z.number().finite().min(0).max(1000000),source:z.string().url().max(500)}).strict()).min(1).max(30),
}).strict().superRefine((v,c)=>{if(new Set(v.rates.map(r=>r.id)).size!==v.rates.length)c.addIssue({code:"custom",message:"Duplicate rate IDs"});if(v.minimumMarginPercent+v.paymentFeePercent>=100)c.addIssue({code:"custom",message:"Margin and payment fees must total less than 100%"});});
export type RateCard=z.infer<typeof rateCardSchema>;
export const defaultRateCard=rateCardSchema.parse(defaults);
/** Supplier list prices are verified; quantities, retries and infrastructure are assumptions until measured. */
export function productionCost(card:RateCard,minutes:number,saleCents?:number){
 const value=rateCardSchema.parse(card);
 if(!Number.isFinite(minutes)||minutes<=0||minutes>8000)throw Error("INVALID_COST_DURATION");
 const lines=value.rates.map(r=>({...r,costUsd:r.usd*r.quantityPerMinute*minutes}));
 const supplierUsd=lines.reduce((sum,r)=>sum+r.costUsd,0),retryReserveUsd=supplierUsd*value.retryReservePercent/100;
 const platformUsd=(value.platformUsdPerMinute+value.remotionUsdPerMinute)*minutes;
 const costBeforePaymentCents=Math.ceil((supplierUsd+retryReserveUsd+platformUsd)*100-1e-8);
 let minimumSaleCents=Math.ceil((costBeforePaymentCents+Math.ceil(value.paymentFixedUsd*100))/(1-(value.minimumMarginPercent+value.paymentFeePercent)/100));
 while((minimumSaleCents-costBeforePaymentCents-Math.ceil(minimumSaleCents*value.paymentFeePercent/100)-Math.ceil(value.paymentFixedUsd*100))*100<minimumSaleCents*value.minimumMarginPercent)minimumSaleCents++;
 const price=saleCents??minimumSaleCents;
 const paymentCents=Math.ceil(price*value.paymentFeePercent/100)+Math.ceil(value.paymentFixedUsd*100);
 const costCents=costBeforePaymentCents+paymentCents;
 return {lines,supplierUsd,retryReserveUsd,platformUsd,costBeforePaymentCents,paymentCents,costCents,minimumSaleCents,saleCents:price,grossMarginPercent:(price-costCents)/price*100,estimated:true as const};
}
