import { afterEach, describe, expect, it, vi } from "vitest";
import { upsertVapiAssistant, connectPhoneNumber, releasePhoneNumber, createOutboundCall, deleteVapiAssistant } from "./vapiClient";
vi.mock("./settings",()=>({voiceSettings:async()=>({apiKey:"test-key",webhookSecret:"test-secret",credentialId:"credential-test",model:"gpt-4o-mini",voiceId:"voice-test",maxDurationSeconds:300})}));
afterEach(()=>vi.unstubAllGlobals());
describe("Vapi request contract",()=>{
  it("uses authenticated server credentials, Persian-capable voice and transcription",async()=>{
    const fetchMock=vi.fn().mockResolvedValue(new Response(JSON.stringify({id:"assistant"}),{status:200}));vi.stubGlobal("fetch",fetchMock);
    await upsertVapiAssistant({name:"Clinic",systemPrompt:"test",serverUrl:"https://example.invalid/webhook",language:"fa",vertical:"clinic"});
    const payload=JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload.server).toEqual({url:"https://example.invalid/webhook",credentialId:"credential-test"});expect(payload.voice.model).toBe("eleven_v3");expect(payload.transcriber.language).toBe("fa");expect(payload.maxDurationSeconds).toBe(300);expect(payload.model.tools.map((t:{function:{name:string}})=>t.function.name)).not.toContain("search_properties");expect(payload.firstMessage).toContain("هوش مصنوعی");
  });
  it("binds existing numbers to the admission webhook and never buys or deletes them",async()=>{
    const fetchMock=vi.fn().mockImplementation(async()=>new Response(JSON.stringify({id:"number",number:"+12025550101"}),{status:200}));vi.stubGlobal("fetch",fetchMock);
    await connectPhoneNumber("number","https://example.invalid/webhook");await releasePhoneNumber("number");
    expect(fetchMock.mock.calls.every(call=>call[1].method==="PATCH")).toBe(true);expect(JSON.parse(fetchMock.mock.calls[0][1].body).assistantId).toBeNull();
  });
  it("propagates reservation metadata and enforces the call ceiling",async()=>{
    const fetchMock=vi.fn().mockResolvedValue(new Response(JSON.stringify({id:"call"}),{status:200}));vi.stubGlobal("fetch",fetchMock);
    await createOutboundCall("assistant","number","+12025550101","reservation");const payload=JSON.parse(fetchMock.mock.calls[0][1].body);expect(payload.metadata.reservationId).toBe("reservation");expect(payload.assistantOverrides.maxDurationSeconds).toBe(300);
  });
  it("does not leak provider response details to customer errors",async()=>{
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response("secret raw provider details",{status:401})));
    await expect(createOutboundCall("a","n","+12025550101","r")).rejects.toThrow("401");await expect(createOutboundCall("a","n","+12025550101","r")).rejects.not.toThrow("secret raw");
  });
  it("handles successful empty delete responses",async()=>{vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response(null,{status:204})));await expect(deleteVapiAssistant("a")).resolves.toBeUndefined();});
});
