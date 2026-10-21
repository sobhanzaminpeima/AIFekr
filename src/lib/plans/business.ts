import packages from "./business.json";
export const BUSINESS_PACKAGES = packages;
export const BUSINESS_CODES = packages.map(plan => plan.planCode);
export function isBusinessBundle(code: string) { return BUSINESS_CODES.includes(code); }

export function businessIncludesVoice(code:string){return packages.some(p=>p.planCode===code&&p.voiceIncluded);}
