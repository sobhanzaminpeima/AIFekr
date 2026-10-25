export function quizSecondsLeft(expiresAt:string|null,serverNow:string,elapsedMs:number):number|null{
 if(expiresAt===null)return null;
 const budget=Date.parse(expiresAt)-Date.parse(serverNow);
 if(!Number.isFinite(budget)||!Number.isFinite(elapsedMs))return 0;
 return Math.max(0,Math.ceil((budget-Math.max(0,elapsedMs))/1000));
}
