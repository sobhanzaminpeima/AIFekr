import {it,expect} from "vitest";
import {chapterSchema} from "./domain";
import {applyMotionPlan} from "./sceneMotion";
const chapter=chapterSchema.parse({title:"Approved",continuity:"",shots:[{id:"s1",title:"Original",narration:"Keep facts",visualPrompt:"An image"}]});
const plan={shots:[{id:"s1",motion:"PAN",animation:{fadeFrames:12,zoom:1.1,panPercent:3}}]};
it("applies bounded Gemini animation while preserving the director's text",()=>{expect(applyMotionPlan(chapter,plan).shots[0]).toMatchObject({title:"Original",narration:"Keep facts",motion:"PAN"});});
it("rejects missing IDs, executable content and invented chart data",()=>{expect(()=>applyMotionPlan(chapter,{shots:[]})).toThrow();expect(()=>applyMotionPlan(chapter,{shots:[{...plan.shots[0],code:"fetch('secret')"}]})).toThrow();expect(()=>applyMotionPlan(chapter,{shots:[{...plan.shots[0],id:"wrong"}]})).toThrow();expect(()=>applyMotionPlan(chapter,{shots:[{...plan.shots[0],motion:"CHART"}]})).toThrow();});
