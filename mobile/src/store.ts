import {z} from 'zod';
import {request} from './api';
import type {Locale} from './i18n';
export const storeCatalog=z.object({enabled:z.boolean(),mode:z.enum(['sandbox','disabled']),products:z.array(z.object({id:z.string(),credits:z.number().int().positive()})),accountId:z.string().length(64).optional()});
const grant=z.object({verified:z.literal(true),finishAllowed:z.literal(true),credits:z.number().int().positive(),replayed:z.boolean()});
export async function verifyAndFinishPurchase(purchase:{productId:string;purchaseToken?:string|null},locale:Locale,valid:()=>boolean,finish:()=>Promise<unknown>){
 if(!valid())throw Error('Account changed; reopen store purchases');if(!purchase.purchaseToken)throw Error('Store purchase token is missing');
 const result=grant.parse(await request('/api/mobile/v1/billing',locale,{method:'POST',body:JSON.stringify({productId:purchase.productId,purchaseToken:purchase.purchaseToken})}));
 if(!valid())throw Error('Account changed; purchase verification can be retried after signing in');
 await finish();return result;
}
