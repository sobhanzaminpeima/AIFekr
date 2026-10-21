import {expect,it} from "vitest";
import {configurationSchema,policySchema,quote} from "./domain";
const config=configurationSchema.parse({durationSeconds:30,language:"en",ratio:"16:9",mode:"AUTOPILOT",quality:"SMART",budgetCap:100,mediaMode:"MULTIMEDIA"});
const policy=policySchema.parse({enabled:true,silentOnly:true,creditsPerChapter:2,creditsPerRenderMinute:2,creditsPerImage:1,presets:{SMART:{videoPercent:0,imagePercent:100}}});
it("quotes silent image video and rejects audio before any credit reservation",()=>{expect(quote(config,policy).credits).toBeGreaterThan(0);for(const patch of [{narration:true},{music:true},{voiceProfileId:"voice-id"}])expect(()=>quote({...config,...patch},policy)).toThrow("AUDIO_TEMPORARILY_UNAVAILABLE");});
