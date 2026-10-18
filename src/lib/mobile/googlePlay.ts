import {createHash,createHmac} from 'node:crypto';
import jwt from 'jsonwebtoken';
import {z} from 'zod';
export class StoreError extends Error {constructor(public status:number,message:string){super(message);}}
const products=z.array(z.object({id:z.string().regex(/^[a-z0-9][a-z0-9._]{0,99}$/),credits:z.number().int().min(1).max(100000)}).strict()).min(1).max(25);
export function storeConfiguration(){
 // Live billing remains closed until refund reconciliation and store acceptance pass.
 if(process.env.MOBILE_API_ENABLED!=='true'||process.env.MOBILE_DEPLOYMENT_ENV!=='staging'||process.env.MOBILE_STORE_MODE!=='sandbox')throw new StoreError(503,'Store billing is not configured');
 let catalog:z.infer<typeof products>;try{catalog=products.parse(JSON.parse(process.env.GOOGLE_PLAY_PRODUCTS_JSON||''));}catch{throw new StoreError(503,'Store catalog is not configured');}
 if(new Set(catalog.map(p=>p.id)).size!==catalog.length)throw new StoreError(503,'Duplicate store product');
 const secret=process.env.GOOGLE_PLAY_ACCOUNT_SECRET;
 if(!secret||secret.length<32)throw new StoreError(503,'Store account binding is not configured');
 const email=process.env.GOOGLE_PLAY_CLIENT_EMAIL,key=process.env.GOOGLE_PLAY_PRIVATE_KEY?.replace(/\\n/g,'\n');
 if(!email||!key)throw new StoreError(503,'Store verification credentials are not configured');
 return {catalog,secret,email,key,packageName:'com.aifekr.app'};
}
export function storeAccountId(userId:string,secret:string){return createHmac('sha256',secret).update(`aifekr-google-play:${userId}`).digest('hex');}
export function purchaseTokenHash(token:string){return createHash('sha256').update(`google-play:${token}`).digest('hex');}
const receipt=z.object({orderId:z.string().min(1).max(200),obfuscatedExternalAccountId:z.string(),regionCode:z.string().regex(/^[A-Z]{2}$/),purchaseCompletionTime:z.string().datetime({offset:true}),purchaseStateContext:z.object({purchaseState:z.string()}),testPurchaseContext:z.object({fopType:z.literal('TEST')}),productLineItem:z.array(z.object({productId:z.string(),productOfferDetails:z.object({quantity:z.literal(1),refundableQuantity:z.literal(1),consumptionState:z.literal('CONSUMPTION_STATE_YET_TO_BE_CONSUMED'),rentOfferDetails:z.never().optional(),preorderOfferDetails:z.never().optional()})})).length(1)});
export function validatePlayReceipt(raw:unknown,productId:string,accountId:string){
 const parsed=receipt.safeParse(raw);if(!parsed.success)throw new StoreError(409,'Purchase is not an eligible unconsumed test purchase');const value=parsed.data;
 if(value.purchaseStateContext.purchaseState!=='PURCHASED'||value.productLineItem[0].productId!==productId||value.obfuscatedExternalAccountId!==accountId)throw new StoreError(409,'Purchase state, product or account does not match');
 if(new Date(value.purchaseCompletionTime).getTime()>Date.now()+300000)throw new StoreError(409,'Purchase completion time is invalid');
 return {orderId:value.orderId,testPurchase:true};
}
export async function verifyPlayPurchase(token:string,productId:string,userId:string){
 const config=storeConfiguration();const account=storeAccountId(userId,config.secret);
 const assertion=jwt.sign({scope:'https://www.googleapis.com/auth/androidpublisher'},config.key,{algorithm:'RS256',issuer:config.email,audience:'https://oauth2.googleapis.com/token',expiresIn:300});
 const oauth=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion}),signal:AbortSignal.timeout(15000),cache:'no-store',redirect:'error'});
 if(!oauth.ok)throw new StoreError(503,'Store verification unavailable');
 const auth=z.object({access_token:z.string().min(1)}).parse(await oauth.json());
 const response=await fetch(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${config.packageName}/purchases/productsv2/tokens/${encodeURIComponent(token)}`,{headers:{Authorization:`Bearer ${auth.access_token}`},signal:AbortSignal.timeout(15000),cache:'no-store',redirect:'error'});
 if(!response.ok)throw new StoreError(response.status===404?409:503,'Purchase could not be verified');
 return validatePlayReceipt(await response.json(),productId,account);
}
