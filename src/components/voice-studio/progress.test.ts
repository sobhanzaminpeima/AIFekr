import {it,expect} from "vitest";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {LangProvider} from "@/lib/i18n/LangProvider";
import GenerationProgress from "./GenerationProgress";
const render=(status:string,extra={})=>renderToStaticMarkup(createElement(LangProvider,{lang:"en"} as Parameters<typeof LangProvider>[0],createElement(GenerationProgress,{job:{id:"test",status,createdAt:new Date().toISOString(),durationMs:null,...extra}})));
it("shows durable queue and actual provider/saving stages without inventing a percentage",()=>{expect(render("QUEUED")).toContain('aria-busy="true"');expect(render("RUNNING",{providerStartedAt:new Date().toISOString()})).toContain("Generating audio");expect(render("RUNNING",{durationMs:1000})).toContain("Saving audio");expect(render("READY",{durationMs:1000})).toContain('aria-busy="false"');expect(render("QUEUED")).not.toContain("progressbar");});
it("does not present a failed generation as ready",()=>{expect(render("FAILED")).toBe("");});
