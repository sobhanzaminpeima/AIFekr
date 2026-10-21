import { FactoryError } from "./domain";
import type { RegisteredProvider } from "./registry";

export class ProviderFailure extends FactoryError {
  constructor(code:string, public rejected:boolean, public retryable=false) { super(code,502); }
}
/** Byte bounds apply to decoded responses as well as Content-Length; redirects never receive secrets. */
export async function boundedBytes(response:Response,maxBytes:number) {
  if(Number(response.headers.get("content-length"))>maxBytes){await response.body?.cancel();throw new FactoryError("PROVIDER_RESPONSE_TOO_LARGE",502);}
  const reader=response.body?.getReader(), chunks:Uint8Array[]=[];let size=0;
  if(reader)while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>maxBytes){await reader.cancel();throw new FactoryError("PROVIDER_RESPONSE_TOO_LARGE",502);}chunks.push(part.value);}
  return Buffer.concat(chunks);
}
export async function providerRequest(provider:RegisteredProvider,path:string,init:RequestInit,signal:AbortSignal) {
  const eleven=provider.adapter.startsWith("ELEVENLABS_");
  const response=await fetch((eleven?"https://api.elevenlabs.io/v1":"https://api.openai.com/v1")+path,{...init,signal,redirect:"error",headers:{...(eleven?{"xi-api-key":provider.key}:{Authorization:`Bearer ${provider.key}`}),...init.headers}});
  if(!response.ok){await response.body?.cancel();throw new ProviderFailure(`PROVIDER_HTTP_${response.status}`,[400,401,403,404,413,422,429].includes(response.status),[408,429,500,502,503,504].includes(response.status));}
  return response;
}
const request=providerRequest;
export interface MediaResult {bytes:Buffer;mimeType:string;extension:string;providerJobId?:string;usage?:unknown}
export async function generateImage(provider:RegisteredProvider,prompt:string,ratio:string,signal:AbortSignal):Promise<MediaResult> {
  if(provider.adapter==="CLOUDFLARE_IMAGE")return {bytes:await (await import("@/lib/cloudflare/workersAi")).workersAiImage(provider.model,prompt,signal),mimeType:"image/png",extension:"png"};
  if(provider.adapter==="GEMINI_IMAGE"){
    const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(provider.model)}:generateContent`,{method:"POST",redirect:"error",signal,headers:{"x-goog-api-key":provider.key,"Content-Type":"application/json"},body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{responseModalities:["TEXT","IMAGE"],imageConfig:{aspectRatio:ratio}}})});
    if(!response.ok){await response.body?.cancel();throw new ProviderFailure(`PROVIDER_HTTP_${response.status}`,[400,401,403,404,413,422,429].includes(response.status),response.status===429);}
    const data=JSON.parse((await boundedBytes(response,30000000)).toString()) as {candidates?:{content?:{parts?:{inlineData?:{mimeType?:string;data?:string}}[]}}[];usageMetadata?:unknown};
    const image=data.candidates?.flatMap(c=>c.content?.parts || []).find(p=>p.inlineData?.mimeType?.startsWith("image/"))?.inlineData;
    if(!image?.data)throw new FactoryError("INVALID_IMAGE_RESPONSE",502);
    const sharp=(await import("sharp")).default,bytes=await sharp(Buffer.from(image.data,"base64"),{limitInputPixels:40000000}).png().toBuffer();if(bytes.length>20000000)throw new FactoryError("IMAGE_TOO_LARGE",502);return {bytes,mimeType:"image/png",extension:"png",usage:data.usageMetadata};
  }
  const response=await request(provider,"/images/generations",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:provider.model,prompt,n:1,size:ratio==="9:16"?"1024x1536":ratio==="1:1"?"1024x1024":"1536x1024",output_format:"png"})},signal);
  const data=JSON.parse((await boundedBytes(response,30000000)).toString()) as {data?:{b64_json?:string}[];usage?:unknown};
  if(!data.data?.[0]?.b64_json)throw new FactoryError("INVALID_IMAGE_RESPONSE",502);
  const bytes=Buffer.from(data.data[0].b64_json,"base64");if(bytes.length>20000000)throw new FactoryError("IMAGE_TOO_LARGE",502);
  return {bytes,mimeType:"image/png",extension:"png",usage:data.usage};
}
export async function generateSpeech(provider:RegisteredProvider,text:string,voice:string,signal:AbortSignal):Promise<MediaResult> {
  if(text.length>3000)throw new ProviderFailure("NARRATION_TOO_LONG",true);
  const eleven=provider.adapter==="ELEVENLABS_TTS";
  if(eleven && !/^[a-zA-Z0-9_-]{1,100}$/.test(voice))throw new ProviderFailure("INVALID_VOICE_ID",true);
  const response=await request(provider,eleven?`/text-to-speech/${encodeURIComponent(voice)}`:"/audio/speech",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(eleven?{model_id:provider.model,text}:{model:provider.model,input:text,voice,response_format:"mp3"})},signal);
  return {bytes:await boundedBytes(response,20000000),mimeType:"audio/mpeg",extension:"mp3"};
}
export async function generateInstrumental(provider:RegisteredProvider,prompt:string,seconds:number,signal:AbortSignal):Promise<MediaResult> {
  const response=await request(provider,"/music",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model_id:provider.model,prompt,music_length_ms:Math.min(300000,Math.max(3000,seconds*1000)),force_instrumental:true})},signal);
  return {bytes:await boundedBytes(response,30000000),mimeType:"audio/mpeg",extension:"mp3",providerJobId:response.headers.get("song-id") || undefined};
}
export async function submitVideo(provider:RegisteredProvider,prompt:string,portrait:boolean,signal:AbortSignal) {
  const form=new FormData();form.set("model",provider.model);form.set("prompt",prompt);form.set("seconds","4");form.set("size",portrait?"720x1280":"1280x720");
  const response=await request(provider,"/videos",{method:"POST",body:form},signal);
  const data=JSON.parse((await boundedBytes(response,1000000)).toString()) as {id?:string};
  if(!data.id || !/^[a-zA-Z0-9_-]{1,150}$/.test(data.id))throw new FactoryError("INVALID_VIDEO_JOB_RESPONSE",502);
  return data.id;
}
export async function pollVideo(provider:RegisteredProvider,id:string,signal:AbortSignal) {
  if(!/^[a-zA-Z0-9_-]{1,150}$/.test(id))throw new FactoryError("INVALID_PROVIDER_JOB_ID",400);
  const response=await request(provider,`/videos/${encodeURIComponent(id)}`,{method:"GET"},signal);
  const data=JSON.parse((await boundedBytes(response,1000000)).toString()) as {status:string;progress?:number};
  if(data.status==="failed")throw new FactoryError("VIDEO_PROVIDER_JOB_FAILED",502);
  if(data.status!=="completed")return {ready:false as const,progress:data.progress};
  const content=await request(provider,`/videos/${encodeURIComponent(id)}/content`,{method:"GET"},signal);
  return {ready:true as const,result:{bytes:await boundedBytes(content,100000000),mimeType:"video/mp4",extension:"mp4",providerJobId:id} satisfies MediaResult};
}
