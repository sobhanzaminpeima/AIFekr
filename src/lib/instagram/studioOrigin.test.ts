import {it,expect} from "vitest";
import {validStudioOrigin} from "./studioOrigin";
it("accepts canonical browser origin behind an internal reverse proxy",()=>{expect(validStudioOrigin("https://aifekr.com","http://localhost:3000",true)).toBe(true);});
it("rejects foreign and missing origins",()=>{expect(validStudioOrigin("https://evil.example","http://localhost:3000",true)).toBe(false);expect(validStudioOrigin(null,"http://localhost:3000",true)).toBe(false);});
