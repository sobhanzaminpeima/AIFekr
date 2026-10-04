import {beforeEach,afterEach,describe,it,expect,vi} from "vitest";
import {publicAppUrl} from "./publicAppUrl";
afterEach(()=>vi.unstubAllEnvs());
beforeEach(()=>{vi.stubEnv("APP_URL","");vi.stubEnv("NEXT_PUBLIC_APP_URL","");});
describe("public server links",()=>{
 it("never emails localhost links in production",()=>{vi.stubEnv("NODE_ENV","production");vi.stubEnv("NEXT_PUBLIC_APP_URL","http://localhost:3003");expect(publicAppUrl()).toBe("https://aifekr.com");});
 it("uses the runtime canonical origin and strips paths",()=>{vi.stubEnv("NODE_ENV","production");vi.stubEnv("APP_URL","https://aifekr.com/home");expect(publicAppUrl()).toBe("https://aifekr.com");});
 it("permits local test previews outside production",()=>{vi.stubEnv("NODE_ENV","test");vi.stubEnv("NEXT_PUBLIC_APP_URL","http://localhost:3008");expect(publicAppUrl()).toBe("http://localhost:3008");});
});
