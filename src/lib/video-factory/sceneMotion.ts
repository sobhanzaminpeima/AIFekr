import {z} from "zod";
import {chapterSchema,FactoryError} from "./domain";
const animation=z.object({fadeFrames:z.number().int().min(0).max(48),zoom:z.number().min(1).max(1.2),panPercent:z.number().min(-8).max(8)}).strict();
export const motionPlanSchema=z.object({shots:z.array(z.object({id:z.string().max(64),motion:z.enum(["STATIC","PUSH_IN","PAN","TITLE","CHART","MAP"]),animation}).strict()).min(1).max(30)}).strict();
/** Declarative scene code only: model output never becomes executable JS, HTML, URLs or shell commands. */
export function applyMotionPlan(chapter:z.infer<typeof chapterSchema>,raw:unknown){
 const value=motionPlanSchema.parse(raw),ids=value.shots.map(s=>s.id);
 if(ids.length!==chapter.shots.length||new Set(ids).size!==ids.length||ids.some(id=>!chapter.shots.some(s=>s.id===id)))throw new FactoryError("INVALID_MOTION_SHOT_IDS",502);
 return chapterSchema.parse({...chapter,shots:chapter.shots.map(shot=>{
  const plan=value.shots.find(s=>s.id===shot.id)!;
  if(plan.motion==="CHART"&&!shot.chart || plan.motion==="MAP"&&!shot.map)throw new FactoryError("MOTION_REQUIRES_APPROVED_DATA",502);
  return {...shot,motion:plan.motion,animation:plan.animation};
 })});
}
