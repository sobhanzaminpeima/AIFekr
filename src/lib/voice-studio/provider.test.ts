import { describe, it, expect, vi, afterEach } from "vitest";
vi.mock("./config", () => ({ voiceCredentials: async () => ({ base: "https://api.elevenlabs.io/v1", key: "test-secret" }) }));
import { providerEndpoint, synthesize,refreshSpeechCatalog } from "./provider";
afterEach(() => vi.unstubAllGlobals());
describe("ElevenLabs adapter", () => {
    it("reports an exact missing read permission without exposing provider response content",async()=>{vi.stubGlobal("fetch",vi.fn().mockImplementation(async()=>new Response(JSON.stringify({detail:{status:"missing_permissions",message:"API key is missing permission models_read"}}),{status:401})));await expect(refreshSpeechCatalog({persist:false})).rejects.toMatchObject({code:"ELEVENLABS_PERMISSION_MODELS_READ"});});
    it("routes v2 discovery at the API root while preserving v1 synthesis", () => { expect(providerEndpoint("https://api.elevenlabs.io/v1", "/v2/voices")).toBe("https://api.elevenlabs.io/v2/voices"); expect(providerEndpoint("https://api.elevenlabs.io/v1", "/models")).toBe("https://api.elevenlabs.io/v1/models"); });
    it("never retries a paid request after a network interruption", async () => { const fetch = vi.fn().mockRejectedValue(Error("timeout")); vi.stubGlobal("fetch", fetch); await expect(synthesize({ text: "hello", voiceId: "voice", modelId: "model", language: "en", settings: {} }, async () => { })).rejects.toMatchObject({ code: "PROVIDER_OUTCOME_UNKNOWN", confirmedNoOutput: false }); expect(fetch).toHaveBeenCalledTimes(1); });
    it("marks a rejected request as a confirmed no-output failure", async () => { vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 403 }))); await expect(synthesize({ text: "hello", voiceId: "voice", modelId: "model", language: "en", settings: {} }, async () => { })).rejects.toMatchObject({ confirmedNoOutput: true }); });
});
