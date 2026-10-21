import {beforeEach,describe,expect,it,vi} from "vitest";
vi.mock("./registry",()=>({getMediaProvider:vi.fn()}));
vi.mock("@/lib/db/prisma",()=>({prisma:{videoFactoryStep:{count:vi.fn(async()=>0)}}}));
vi.mock("@/lib/ai/router",()=>({getEnabledProviders:vi.fn(()=>[])}));
vi.mock("@/lib/ai/providerConfig",()=>({refreshDisabledProviders:vi.fn()}));
import {approvedProvider} from "./providers";
import {getMediaProvider} from "./registry";
import {getEnabledProviders} from "@/lib/ai/router";
import {prisma} from "@/lib/db/prisma";
describe("Dedicated Video Factory text registry",()=>{
 beforeEach(()=>vi.clearAllMocks());
 it("uses its private credential and fixed origin without the global router",async()=>{
  vi.mocked(getMediaProvider).mockResolvedValue({id:"vf-private-writer",name:"Writer",model:"test-model",adapter:"ANTHROPIC_TEXT",key:"TEST-PRIVATE-KEY",settings:{maxConcurrent:1,requestsPerMinute:100,maxOutputTokens:2000}} as Awaited<ReturnType<typeof getMediaProvider>>);
  const provider=await approvedProvider("vf-private-writer");
  expect(provider.apiKey).toBe("TEST-PRIVATE-KEY");expect(provider.baseURL).toBe("https://api.anthropic.com/v1");expect(provider.maxOutputCeiling).toBe(2000);expect(getEnabledProviders).not.toHaveBeenCalled();
 });
 it("fails closed when its provider is unavailable without global fallback",async()=>{
  vi.mocked(getMediaProvider).mockRejectedValue(new Error("NO_APPROVED_TEXT_PROVIDER"));
  await expect(approvedProvider("vf-missing")).rejects.toThrow("NO_APPROVED_TEXT_PROVIDER");expect(getEnabledProviders).not.toHaveBeenCalled();
 });
 it("maps a custom OpenAI-compatible provider to its configured endpoint",async()=>{
  vi.mocked(getMediaProvider).mockResolvedValue({id:"vf-codecraft-sonnet",name:"CodeCraft Sonnet",model:"claude-sonnet-5",adapter:"OPENAI_COMPAT_TEXT",key:"TEST-PRIVATE-KEY",settings:{baseUrl:"https://codecraftapi.com/v1",maxConcurrent:1,requestsPerMinute:100,maxOutputTokens:6000}} as Awaited<ReturnType<typeof getMediaProvider>>);
  const provider=await approvedProvider("vf-codecraft-sonnet");
  expect(provider.provider).toBe("codecraft");expect(provider.baseURL).toBe("https://codecraftapi.com/v1");expect(provider.model).toBe("claude-sonnet-5");
 });
 it("blocks submission when the dedicated concurrency limit is reached",async()=>{
  vi.mocked(getMediaProvider).mockResolvedValue({id:"vf-busy",settings:{maxConcurrent:1,requestsPerMinute:10}} as Awaited<ReturnType<typeof getMediaProvider>>);
  vi.mocked(prisma.videoFactoryStep.count).mockResolvedValueOnce(1);
  await expect(approvedProvider("vf-busy")).rejects.toThrow("TEXT_PROVIDER_BUSY");
 });
});
