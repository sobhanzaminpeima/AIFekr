import {expect,it} from "vitest";
import {NextRequest} from "next/server";
import {middleware} from "../../middleware";
it("rewrites all translated landing pages over internal HTTP behind TLS termination",()=>{for(const lang of ["en","de","tr"]){const response=middleware(new NextRequest(`https://localhost:3000/${lang}`,{headers:{host:"aifekr.com","x-forwarded-proto":"https"}}));expect(response.headers.get("x-middleware-rewrite")).toBe("http://localhost:3000/");expect(response.headers.get("x-middleware-request-x-public-lang")).toBe(lang);}});
it("keeps external public HTTPS origins and Persian redirect behavior",()=>{expect(middleware(new NextRequest("https://aifekr.com/en")).headers.get("x-middleware-rewrite")).toBe("https://aifekr.com/");expect(middleware(new NextRequest("https://aifekr.com/fa")).status).toBe(308);});
