/** Safe provider errors: never send provider text, prompts or credentials to clients. */
export class ImageSafetyError extends Error {
 constructor(){super('IMAGE_SAFETY_REJECTED');}
}
export function imageProviderError(status:number,error?:{code?:string;message?:string}) {
 if(status===400 && (/content_policy_violation|moderation_blocked|safety_violations/.test(error?.code||'') || /safety system|safety filter|content policy/i.test(error?.message||'')))return new ImageSafetyError();
 return new Error(`IMAGE_PROVIDER_HTTP_${status}`);
}
