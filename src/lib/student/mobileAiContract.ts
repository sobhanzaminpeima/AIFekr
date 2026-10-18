import {createHash} from 'node:crypto';
import {PROVIDERS} from '@/lib/ai/providers';
import {getEnabledProviders} from '@/lib/ai/router';
import {refreshDisabledProviders} from '@/lib/ai/providerConfig';
export const STUDENT_AI_MINIMUM_BALANCE=5;
export function studentAiHash(input:{courseId:string;action:string;prompt:string;count:number;timeLimitSeconds?:number|null;maxCredits:number}){
 return createHash('sha256').update(JSON.stringify({courseId:input.courseId,action:input.action,prompt:input.prompt,count:input.count,timeLimitSeconds:input.timeLimitSeconds??null,maxCredits:input.maxCredits})).digest('hex');
}
export async function studentAiQuote(){await refreshDisabledProviders();return {available:getEnabledProviders().length>0,maxCredits:Math.max(STUDENT_AI_MINIMUM_BALANCE,...PROVIDERS.map(provider=>provider.creditCost))};}
