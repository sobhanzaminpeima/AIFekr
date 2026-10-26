export function shouldShowFitness(input:{fitness?:boolean;role?:string;fitnessAccessExpiry?:Date|string|null;hasProfile?:boolean;accountType?:string|null;industryPackId?:string|null;crmActive?:boolean},now=new Date()){
 return !!input.fitness||["ADMIN","SUPER_ADMIN"].includes(input.role||"")||!!input.hasProfile||!!input.fitnessAccessExpiry&&new Date(input.fitnessAccessExpiry)>now||(input.accountType!=="BUSINESS"&&!input.industryPackId&&!input.crmActive);
}
