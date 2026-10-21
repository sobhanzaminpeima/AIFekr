import {z} from "zod";
import {FactoryError} from "./errors";
import {productionCost,rateCardSchema} from "./costing";
export const commercialSchema=z.object({mode:z.enum(["ACTION","DURATION_RETAIL"]).default("ACTION"),status:z.enum(["DRAFT","APPROVED"]).default("DRAFT"),estimated:z.boolean().default(true),baseSeconds:z.number().int().min(15).max(3600).default(600),estimatedCostCents:z.number().int().min(0).max(10000000).default(2500),saleCents:z.number().int().positive().max(10000000).default(5900),overheadCents:z.number().int().nonnegative().max(10000000).default(0),referencePlanCode:z.string().regex(/^[A-Z0-9_]{2,60}$/).default("PRO_USD"),creditRate:z.object({planCode:z.string(),usdCents:z.number().int().positive(),credits:z.number().int().positive()}).nullable().default(null),textModels:z.object({writer:z.string().max(100).default("claude"),researcher:z.string().max(100).default("gemini")}).default({writer:"claude",researcher:"gemini"}),renderer:z.enum(["FFMPEG","REMOTION"]).default("FFMPEG"),remotionLicenseApproved:z.boolean().default(false)}).strict();
export const detailedCommercialSchema=commercialSchema.extend({rateCard:rateCardSchema.nullable().default(null),motionModel:z.string().max(100).default(""),pipeline:z.enum(["LEGACY","IMAGE_MOTION"]).default("LEGACY")});
export type Commercial=z.infer<typeof detailedCommercialSchema>;
/** Integer monetary arithmetic. Rate is taken from an existing platform package. */
export function commercialEstimate(value:z.infer<typeof commercialSchema>&{rateCard?:z.infer<typeof rateCardSchema>|null},seconds:number,quality:"SMART"|"CINEMATIC_HYBRID"|"FILM_STUDIO"="SMART"){
 if(!Number.isSafeInteger(seconds)||seconds<15||seconds>3600)throw new FactoryError("INVALID_DURATION",400);
 let saleCents=Math.ceil(value.saleCents*seconds/value.baseSeconds),estimatedCostCents=Math.ceil((value.estimatedCostCents+value.overheadCents)*seconds/value.baseSeconds);
 let production:ReturnType<typeof productionCost>|null=null;
 if(value.rateCard){
  const minutes=Math.max(1,seconds/60),card={...value.rateCard,rates:value.rateCard.rates.map(r=>r.id==="video"?{...r,quantityPerMinute:Math.max(r.quantityPerMinute,quality==="SMART"?0:quality==="CINEMATIC_HYBRID"?24:60)}:r)};
  const floor=productionCost(card,minutes);saleCents=Math.max(saleCents,floor.minimumSaleCents);
  production=productionCost(card,minutes,saleCents);estimatedCostCents=production.costCents;
 }
 const grossProfitCents=saleCents-estimatedCostCents;
 const credits=value.creditRate?Math.ceil(saleCents*value.creditRate.credits/value.creditRate.usdCents):null;
 return {seconds,saleCents,estimatedCostCents,grossProfitCents,grossMarginPercent:Math.round(grossProfitCents/saleCents*10000)/100,markupPercent:estimatedCostCents?Math.round(grossProfitCents/estimatedCostCents*10000)/100:null,credits,creditRate:value.creditRate,estimated:production?true:value.estimated,status:value.status,currency:"USD",production,excludes:production?"taxes; account-specific supplier rates and infrastructure require reconciliation":"taxes, payment fees and unconfigured overhead"};
}
