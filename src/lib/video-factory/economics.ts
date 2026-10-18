import {z} from "zod";
import {FactoryError} from "./errors";
export const commercialSchema=z.object({mode:z.enum(["ACTION","DURATION_RETAIL"]).default("ACTION"),status:z.enum(["DRAFT","APPROVED"]).default("DRAFT"),estimated:z.boolean().default(true),baseSeconds:z.number().int().min(15).max(3600).default(600),estimatedCostCents:z.number().int().min(0).max(10000000).default(2500),saleCents:z.number().int().positive().max(10000000).default(5900),overheadCents:z.number().int().nonnegative().max(10000000).default(0),referencePlanCode:z.string().regex(/^[A-Z0-9_]{2,60}$/).default("PRO_USD"),creditRate:z.object({planCode:z.string(),usdCents:z.number().int().positive(),credits:z.number().int().positive()}).nullable().default(null),textModels:z.object({writer:z.string().max(100).default("claude"),researcher:z.string().max(100).default("gemini")}).default({writer:"claude",researcher:"gemini"}),renderer:z.enum(["FFMPEG","REMOTION"]).default("FFMPEG"),remotionLicenseApproved:z.boolean().default(false)}).strict();
export type Commercial=z.infer<typeof commercialSchema>;
/** Integer monetary arithmetic. Rate is taken from an existing platform package. */
export function commercialEstimate(value:Commercial,seconds:number){
 if(!Number.isSafeInteger(seconds)||seconds<15||seconds>3600)throw new FactoryError("INVALID_DURATION",400);
 const saleCents=Math.ceil(value.saleCents*seconds/value.baseSeconds),estimatedCostCents=Math.ceil((value.estimatedCostCents+value.overheadCents)*seconds/value.baseSeconds),grossProfitCents=saleCents-estimatedCostCents;
 const credits=value.creditRate?Math.ceil(saleCents*value.creditRate.credits/value.creditRate.usdCents):null;
 return {seconds,saleCents,estimatedCostCents,grossProfitCents,grossMarginPercent:Math.round(grossProfitCents/saleCents*10000)/100,markupPercent:estimatedCostCents?Math.round(grossProfitCents/estimatedCostCents*10000)/100:null,credits,creditRate:value.creditRate,estimated:value.estimated,status:value.status,currency:"USD",excludes:"taxes, payment fees and unconfigured overhead"};
}
