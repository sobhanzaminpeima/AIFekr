import {it,expect,vi} from "vitest";
vi.mock("@/lib/ai/router",()=>({routedStreamChat:vi.fn()}));
vi.mock("@/lib/ai/customProviders",()=>({isCustomProviderModel:vi.fn(),streamCustomProvider:vi.fn()}));
import {getOAuthUrl} from "../instagram";
it("forces fresh Instagram account selection and preserves callback state",()=>{
 const url=new URL(getOAuthUrl("https://aifekr.com/api/social/instagram/callback","nonce"));
 expect(url.searchParams.get("force_authentication")).toBe("1");
 expect(url.searchParams.get("enable_fb_login")).toBe("0");
 expect(url.searchParams.get("state")).toBe("nonce");
 expect(url.searchParams.get("redirect_uri")).toBe("https://aifekr.com/api/social/instagram/callback");
});
