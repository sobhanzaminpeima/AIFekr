/** A subscription expires immediately; purchasing credits never extends it. */
export function featureAccessExpired(user:{plan?:string;planExpiry?:Date|null;trialEndsAt?:Date|null;trialLimited?:boolean},teamExpiry?:Date|null,now=Date.now()):boolean {
 const expiry=teamExpiry&&user.plan==="FREE"?teamExpiry:user.planExpiry;
 if(expiry&&expiry.getTime()<=now)return true;
 const paid=(user.plan==="FREE"&&!!teamExpiry&&teamExpiry.getTime()>now)||(user.plan&&user.plan!=="FREE"&&(!expiry||expiry.getTime()>now));
 return !paid&&!!user.trialEndsAt&&user.trialEndsAt.getTime()<=now;
}
export function isRecoveryApi(path:string):boolean{
 if(path==='/api/mobile/v1/billing')return true;
 if(path==="/api/mobile/v1/session"||path.startsWith("/api/mobile/v1/session/"))return true;
 if(path==="/api/mobile/v1/fitness"||path.startsWith("/api/mobile/v1/fitness/"))return true;
 if(path==="/api/support/chat")return false;
 return ["/api/auth/","/api/billing/","/api/fitness","/api/payment/","/api/checkout/","/api/bank/","/api/admin/","/api/profile","/api/user/profile","/api/user/payments","/api/user/onboarding","/api/user/currency","/api/account","/api/support/","/api/packages","/api/plans","/api/notifications","/api/wallet","/api/credits/","/api/user/usage/history"].some(p=>path===p||path.startsWith(p));
}
export function teamFeatureExpiry(team:{planExpiry?:Date|null;owner?:{planExpiry?:Date|null}}|undefined|null):Date|null{
 const dates=[team?.planExpiry,team?.owner?.planExpiry].filter((d):d is Date=>!!d);
 return dates.length?new Date(Math.min(...dates.map(d=>d.getTime()))):null;
}
