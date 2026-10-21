import {getCloudflareConfig} from "./config";
import {decryptSecret} from "@/lib/crypto/secretBox";

export async function workersAiCredentials(){const config=await getCloudflareConfig();if(!config.enabled||!config.token||!config.accountId)throw Error("CLOUDFLARE_NOT_CONFIGURED");return {accountId:config.accountId,key:decryptSecret(config.token),baseURL:`https://api.cloudflare.com/client/v4/accounts/${config.accountId}/ai/v1`};}
export function validWorkersModel(model:string){return /^@cf\/[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(model);}
/** Fixed Cloudflare origin and bounded decoded data. No model-supplied URL is fetched. */
export async function workersAiImage(model:string,prompt:string,signal=AbortSignal.timeout(90000)){
 if(!validWorkersModel(model))throw Error("INVALID_CLOUDFLARE_MODEL");
 const {accountId,key}=await workersAiCredentials();
 const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`,{method:"POST",redirect:"error",signal,headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({prompt:prompt.slice(0,2048),steps:4})});
 const {boundedBytes}=await import("@/lib/video-factory/mediaAdapters");
 if(!response.ok){await response.body?.cancel();throw Error(`CLOUDFLARE_HTTP_${response.status}`);}
 const raw=await boundedBytes(response,28000000);let bytes:Buffer;
 if(response.headers.get("content-type")?.startsWith("image/"))bytes=raw;
 else{const data=JSON.parse(raw.toString());if(data.success===false||typeof data.result?.image!=="string")throw Error("INVALID_CLOUDFLARE_IMAGE");bytes=Buffer.from(data.result.image,"base64");}
 const sharp=(await import("sharp")).default;return sharp(bytes,{limitInputPixels:40000000}).png().toBuffer();
}
export async function probeWorkersAi(){const {accountId,key}=await workersAiCredentials();const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/models/search?per_page=100`,{headers:{Authorization:`Bearer ${key}`},redirect:"error",signal:AbortSignal.timeout(15000),cache:"no-store"});const data=await response.json();if(!response.ok||!data.success)throw Error(`CLOUDFLARE_AI_HTTP_${response.status}`);return {available:true,models:(data.result as {name:string;task?:{name?:string}}[]).map(m=>({name:m.name,task:m.task?.name||""})),paidRequests:0};}
