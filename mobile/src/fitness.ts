import {z} from 'zod';
export const programSchema=z.array(z.object({exerciseId:z.string(),sets:z.number().int().min(1).max(10),reps:z.number().int().min(1).max(60),rest:z.number().min(15).max(300),tempo:z.string().optional()}));
export const setSchema=z.object({exerciseId:z.string(),setNumber:z.number().int().min(1).max(10),repetitions:z.number().int().min(0).max(100),weightGrams:z.number().int().min(0).max(500000),completed:z.boolean(),rpe:z.preprocess(v=>v===null?undefined:v,z.number().int().min(1).max(10).optional()),rir:z.preprocess(v=>v===null?undefined:v,z.number().int().min(0).max(10).optional())});
export type WorkoutSet=z.infer<typeof setSchema>;
export function initialSets(snapshot:string,existing:WorkoutSet[]=[]):WorkoutSet[]{return programSchema.parse(JSON.parse(snapshot)).flatMap(ex=>Array.from({length:ex.sets},(_,i)=>existing.find(s=>s.exerciseId===ex.exerciseId&&s.setNumber===i+1)||{exerciseId:ex.exerciseId,setNumber:i+1,repetitions:ex.reps,weightGrams:0,completed:false}));}
export function completeWorkout(sets:WorkoutSet[]){return sets.length>0&&sets.every(s=>s.completed&&s.repetitions>0);}
