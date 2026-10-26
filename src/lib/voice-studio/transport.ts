import {ProxyAgent} from "undici";
let cached:{url:string;agent:ProxyAgent}|undefined;
/** Reuse the platform's existing CONNECT tunnel. TLS is still verified against ElevenLabs. */
export function voiceTransport(){
 const url=process.env.ELEVENLABS_PROXY_URL||process.env.INSTAGRAM_MEDIA_PROXY_URL;
 if(!url)return {};
 if(!cached||cached.url!==url)cached={url,agent:new ProxyAgent(url)};
 return {dispatcher:cached.agent};
}
