import {afterEach,describe,expect,it,vi} from "vitest";
vi.mock("@/lib/ai/providers",()=>({PROVIDERS:[{id:"openai-direct",provider:"openai",model:"gpt-5.4-nano",apiKey:"test-provider-key",baseURL:"https://provider.invalid/v1"}]}));
import {ocrImages} from "./ocr";
afterEach(()=>vi.unstubAllGlobals());
describe("student OCR provider compatibility",()=>{
 it("reads image text when the configured model rejects the legacy token parameter",async()=>{
  vi.stubGlobal("fetch",vi.fn(async(_url:string,init:RequestInit)=>{
   const body=JSON.parse(String(init.body));
   if("max_tokens" in body)return new Response(JSON.stringify({error:{message:"Unsupported parameter max_tokens"}}),{status:400});
   return new Response(JSON.stringify({choices:[{finish_reason:"stop",message:{content:"Newton's second law: F = m a"}}]}),{status:200});
  }));
  await expect(ocrImages([{name:"physics.png",mimeType:"image/png",data:Buffer.from([137,80,78,71])}],"en")).resolves.toContain("F = m a");
 });
 it("rejects a truncated transcription instead of saving incomplete source text",async()=>{
  vi.stubGlobal("fetch",vi.fn(async()=>new Response(JSON.stringify({choices:[{finish_reason:"length",message:{content:"incomplete source"}}]}),{status:200})));
  await expect(ocrImages([{name:"physics.png",mimeType:"image/png",data:Buffer.from([137,80,78,71])}],"en")).rejects.toThrow("VISION_TRUNCATED");
 });
});
