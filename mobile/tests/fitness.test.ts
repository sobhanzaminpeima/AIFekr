import {describe,it,expect} from 'vitest';
import {initialSets,completeWorkout,setSchema} from '../src/fitness';
const snapshot=JSON.stringify([{exerciseId:'squat',sets:2,reps:8,rest:60}]);
describe('native workout capture',()=>{
 it('does not mark prescribed repetitions as completed exercise',()=>{expect(initialSets(snapshot).every(s=>!s.completed)).toBe(true);expect(completeWorkout(initialSets(snapshot))).toBe(false);});
 it('preserves saved logs when resuming a session',()=>{const existing={exerciseId:'squat',setNumber:1,repetitions:7,weightGrams:20000,completed:true};expect(initialSets(snapshot,[existing])[0]).toEqual(existing);});
 it('requires every set to have actual positive repetitions before completion',()=>{expect(completeWorkout(initialSets(snapshot).map(s=>({...s,completed:true})))).toBe(true);expect(completeWorkout([{exerciseId:'squat',setNumber:1,repetitions:0,weightGrams:0,completed:true}])).toBe(false);});
 it('rejects unsafe or invalid weight inputs',()=>{expect(()=>setSchema.parse({exerciseId:'squat',setNumber:1,repetitions:8,weightGrams:-1,completed:true})).toThrow();});
 it('preserves recorded effort values and normalizes database nulls for sync',()=>{const row={exerciseId:'squat',setNumber:1,repetitions:8,weightGrams:20000,completed:true,rpe:7,rir:null};expect(setSchema.parse(row).rpe).toBe(7);expect(setSchema.parse(row).rir).toBeUndefined();});
});
