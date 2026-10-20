import {prisma} from "@/lib/db/prisma";
import {decryptSecret} from "@/lib/crypto/secretBox";
/** A linked custom model reuses the encrypted provider vault; credentials never enter admin responses. */
export async function resolveCustomApiKey(value:string){
 if(value==="cf-ref:platform")return (await (await import("@/lib/cloudflare/workersAi")).workersAiCredentials()).key;
 if(value.startsWith("vf-ref:")){
  const id=value.slice(7);if(!/^[a-z0-9-]{3,80}$/.test(id))throw Error("INVALID_CREDENTIAL_REFERENCE");
  const row=await prisma.videoFactoryProvider.findUnique({where:{id}});if(!row)throw Error("CREDENTIAL_REFERENCE_NOT_FOUND");
  const key=row.secret?decryptSecret(row.secret):row.credentialRef?process.env[row.credentialRef]:null;
  if(!key)throw Error("API_KEY_NOT_CONFIGURED");return key;
 }
 return value.startsWith("enc:v1:")?decryptSecret(value):value;
}
