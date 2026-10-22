import {beforeEach,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({find:vi.fn(),stream:vi.fn()}));
vi.mock("@/lib/db/prisma",()=>({prisma:{customAiProvider:{findUnique:mocks.find}}}));
vi.mock("@/lib/ai/providers",()=>({streamProvider:mocks.stream}));
import {independentChatProvider} from "./provider";
beforeEach(()=>{vi.clearAllMocks();process.env.OPENAI_API_KEY="test-only-not-a-real-key";mocks.find.mockResolvedValue({enabled:true,type:"chat",model:"gpt-5-mini",baseUrl:"https://api.openai.com/v1"});mocks.stream.mockResolvedValue({promptTokens:3,completionTokens:2,totalTokens:5});});
it("uses OpenAI GPT directly without a silent Cloudflare fallback",async()=>{await independentChatProvider("openai-gpt-5-mini",[],"Hello","en",()=>{},new AbortController().signal);expect(mocks.stream.mock.calls[0][0]).toMatchObject({provider:"openai",baseURL:"https://api.openai.com/v1",model:"gpt-5-mini",maxTokens:2000});});
it("respects disabled models and refuses missing OpenAI credentials",async()=>{mocks.find.mockResolvedValueOnce({enabled:false});await expect(independentChatProvider("openai-gpt-5-mini",[],"Hello","en",()=>{},new AbortController().signal)).rejects.toThrow("MODEL_NOT_APPROVED");delete process.env.OPENAI_API_KEY;await expect(independentChatProvider("openai-gpt-5-mini",[],"Hello","en",()=>{},new AbortController().signal)).rejects.toThrow("OPENAI_KEY_MISSING");expect(mocks.stream).not.toHaveBeenCalled();});
