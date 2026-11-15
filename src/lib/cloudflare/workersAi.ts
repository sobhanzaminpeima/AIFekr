import {getCloudflareConfig} from "./config";
import {decryptSecret} from "@/lib/crypto/secretBox";

export async function workersAiCredentials(){const config=await getCloudflareConfig();if(!config.enabled||!config.token||!config.accountId)throw Error("CLOUDFLARE_NOT_CONFIGURED");return {accountId:config.accountId,key:decryptSecret(config.token),baseURL:`https://api.cloudflare.com/client/v4/accounts/${config.accountId}/ai/v1`};}
export function validWorkersModel(model:string){return /^@cf\/[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(model);}
/** Fixed Cloudflare origin and bounded decoded data. No model-supplied URL is fetched. */
export async function workersAiImage(model:string,prompt:string,signal=AbortSignal.timeout(90000)){
 if(!validWorkersModel(model))throw Error("INVALID_CLOUDFLARE_MODEL");
 const {accountId,key}=await workersAiCredentials();
 const {boundedBytes,ProviderFailure}=await import("@/lib/video-factory/mediaAdapters");
 let response:Response;
 try {
  response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`,{method:"POST",redirect:"error",signal,headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({prompt:prompt.slice(0,2048),steps:4})});
 } catch {
  throw new ProviderFailure("PROVIDER_OUTCOME_UNCERTAIN",false);
 }
 if(!response.ok){
  await response.body?.cancel().catch(()=>{});
  const rejected=[400,401,403,404,413,422,429].includes(response.status);
  throw new ProviderFailure(`CLOUDFLARE_HTTP_${response.status}`,rejected,response.status===429);
 }
 const raw=await boundedBytes(response,28000000).catch(error=>{
  if(error instanceof TypeError || signal.aborted)throw new ProviderFailure("PROVIDER_OUTCOME_UNCERTAIN",false);
  throw error;
 });
 try {
  let bytes=raw;
  if(!response.headers.get("content-type")?.startsWith("image/")){
   const data=JSON.parse(raw.toString());
   if(data.success===false||typeof data.result?.image!=="string")throw Error("Missing image");
   bytes=Buffer.from(data.result.image,"base64");
  }
  const sharp=(await import("sharp")).default;
  return await sharp(bytes,{limitInputPixels:40000000}).png().toBuffer();
 } catch {
  throw new ProviderFailure("INVALID_CLOUDFLARE_IMAGE",false);
 }
}
export async function probeWorkersAi(){const {accountId,key}=await workersAiCredentials();const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/models/search?per_page=100`,{headers:{Authorization:`Bearer ${key}`},redirect:"error",signal:AbortSignal.timeout(15000),cache:"no-store"});const data=await response.json();if(!response.ok||!data.success)throw Error(`CLOUDFLARE_AI_HTTP_${response.status}`);return {available:true,models:(data.result as {name:string;task?:{name?:string}}[]).map(m=>({name:m.name,task:m.task?.name||""})),paidRequests:0};}
