import {beforeEach,it,expect,vi} from "vitest";
const state=vi.hoisted(()=>({secret:"",missing:false}));
vi.mock("@/lib/db/prisma",()=>({prisma:{videoFactoryProvider:{findUnique:async()=>state.missing?null:{secret:state.secret,credentialRef:null}}}}));
import {resolveCustomApiKey} from "./customCredentials";
import {encryptSecret} from "@/lib/crypto/secretBox";
beforeEach(()=>{vi.stubEnv("TOKEN_ENCRYPTION_KEY","test-only-custom-credentials-key");state.secret=encryptSecret("TEST-ONLY-CREDENTIAL");state.missing=false;});
it("reuses the encrypted vault and preserves legacy custom providers",async()=>{expect(await resolveCustomApiKey("vf-ref:vf-codecraft-test")).toBe("TEST-ONLY-CREDENTIAL");expect(await resolveCustomApiKey("legacy-test-key")).toBe("legacy-test-key");});
it("fails closed on invalid or missing references",async()=>{await expect(resolveCustomApiKey("vf-ref:../secret")).rejects.toThrow();state.missing=true;await expect(resolveCustomApiKey("vf-ref:vf-codecraft-test")).rejects.toThrow("CREDENTIAL_REFERENCE_NOT_FOUND");});
