import {beforeEach,afterEach,expect,it,vi} from "vitest";
vi.mock("./config",()=>({getCloudflareConfig:async()=>({enabled:true,accountId:"a".repeat(32),token:"test-token"})}));
vi.mock("@/lib/crypto/secretBox",()=>({decryptSecret:()=>"test-only-key"}));
import {workersAiImage,validWorkersModel,probeWorkersAi} from "./workersAi";

const flux = "@cf/black-forest-labs/flux-1-schnell";
it("allows a rejected rate-limited image to be retried by the factory worker",async()=>{
  vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response(null,{status:429})));
  await expect(workersAiImage(flux,"Test image")).rejects.toMatchObject({code:"CLOUDFLARE_HTTP_429",rejected:true,retryable:true});
});
it("does not mark a disconnected or invalid image response as safe to retry",async()=>{
  const fetcher=vi.fn().mockRejectedValueOnce(new TypeError("fetch failed"))
    .mockResolvedValueOnce(Response.json({success:true,result:{}}));
  vi.stubGlobal("fetch",fetcher);
  await expect(workersAiImage(flux,"Test image")).rejects.toMatchObject({code:"PROVIDER_OUTCOME_UNCERTAIN",rejected:false,retryable:false});
  await expect(workersAiImage(flux,"Test image")).rejects.toMatchObject({code:"INVALID_CLOUDFLARE_IMAGE",rejected:false,retryable:false});
  expect(fetcher).toHaveBeenCalledTimes(2);
});
beforeEach(()=>vi.unstubAllGlobals());afterEach(()=>vi.unstubAllGlobals());
it("rejects paths and unapproved model syntax before making requests",async()=>{const fetcher=vi.fn();vi.stubGlobal("fetch",fetcher);await expect(workersAiImage("../../user/tokens","x")).rejects.toThrow("INVALID_CLOUDFLARE_MODEL");expect(fetcher).not.toHaveBeenCalled();expect(validWorkersModel("@cf/black-forest-labs/flux-1-schnell")).toBe(true);});
it("checks model access without generation or exposing credentials",async()=>{const fetcher=vi.fn(async()=>new Response(JSON.stringify({success:true,result:[{name:"@cf/meta/test",task:{name:"Text Generation"}}]})));vi.stubGlobal("fetch",fetcher);const result=await probeWorkersAi();expect(result.paidRequests).toBe(0);expect(JSON.stringify(result)).not.toContain("test-only-key");expect(fetcher.mock.calls[0]).toBeDefined();});
it("normalizes a generated image to PNG using bounded data",async()=>{const sharp=(await import("sharp")).default,jpeg=await sharp({create:{width:16,height:16,channels:3,background:"orange"}}).jpeg().toBuffer();vi.stubGlobal("fetch",vi.fn(async()=>new Response(JSON.stringify({success:true,result:{image:jpeg.toString("base64")}}),{headers:{"content-type":"application/json"}})));const bytes=await workersAiImage("@cf/black-forest-labs/flux-1-schnell","A planet");expect((await sharp(bytes).metadata()).format).toBe("png");});
