import {beforeEach,afterEach,describe,it,expect,vi} from "vitest";
const mocks=vi.hoisted(()=>({stream:vi.fn(),available:vi.fn()}));
const providers=vi.hoisted(()=>[{id:"one",name:"One",model:"model-one",provider:"groq",apiKey:"test",baseURL:"https://invalid.test",strengths:[],maxTokens:100,creditCost:1},{id:"two",name:"Two",model:"model-two",provider:"groq",apiKey:"test",baseURL:"https://invalid.test",strengths:[],maxTokens:100,creditCost:1}]);
vi.mock("./providers",()=>({PROVIDERS:providers,getAvailableProviders:mocks.available,streamProvider:mocks.stream}));
vi.mock("./providerConfig",()=>({refreshDisabledProviders:async()=>{},getDisabledProviders:()=>new Set()}));
import {routedStreamChat,detectQueryType} from "./router";
beforeEach(()=>{vi.useFakeTimers();vi.clearAllMocks();mocks.available.mockReturnValue(providers)});
afterEach(()=>vi.useRealTimers());
describe("low-latency chat routing",()=>{
 it("falls back immediately on rate limiting when another provider is available",async()=>{
  const start=Date.now();mocks.stream.mockRejectedValueOnce(new Error("One error 429: rate limit")).mockImplementationOnce(async(_p,_m,_s,chunk)=>{chunk("Answer");return null});
  const chunks:string[]=[];const result=await routedStreamChat([{role:"user",content:"Hello"}],"Test",s=>chunks.push(s),()=>{},"model-one");
  expect(result.id).toBe("two");expect(Date.now()-start).toBe(0);expect(chunks).toEqual(["Answer"]);
 });
 it("aborts a provider that produces no token and uses the fallback after 8 seconds",async()=>{
  let aborted=false;mocks.stream.mockImplementationOnce((_p,_m,_s,_chunk,_max,signal:AbortSignal)=>new Promise((_resolve,reject)=>{signal.addEventListener("abort",()=>{aborted=true;reject(new Error("aborted"))})})).mockResolvedValueOnce(null);
  const pending=routedStreamChat([{role:"user",content:"Test"}],"Test",()=>{},()=>{},"model-one");
  await vi.advanceTimersByTimeAsync(8000);expect((await pending).id).toBe("two");expect(aborted).toBe(true);
 });
 it("preserves partial-response reset signals on fallback",async()=>{
  const fallback=vi.fn();mocks.stream.mockImplementationOnce(async(_p,_m,_s,chunk)=>{chunk("Partial");throw new Error("failed")}).mockResolvedValueOnce(null);
  await routedStreamChat([{role:"user",content:"Test"}],"Test",()=>{},()=>{},"model-one",fallback);expect(fallback).toHaveBeenCalledWith({from:providers[0],partial:true});
 });
 it("identifies short Persian and international greetings as fast queries",()=>{for(const s of ["سلام","hello","hallo","merhaba"])expect(detectQueryType(s)).toBe("fast")});
});
