import {describe,it,expect} from 'vitest';
import {elapsedStudySeconds,studyTimer} from '../src/student';
describe('server study time',()=>{
 it('uses server elapsed time and advances only running sessions',()=>{expect(elapsedStudySeconds({elapsedSeconds:50,pausedAt:null},1000,6000)).toBe(55);expect(elapsedStudySeconds({elapsedSeconds:50,pausedAt:'2026-10-14'},1000,6000)).toBe(50);});
 it('bounds clock movement and the server maximum',()=>{expect(elapsedStudySeconds({elapsedSeconds:50,pausedAt:null},6000,1000)).toBe(50);expect(elapsedStudySeconds({elapsedSeconds:43199,pausedAt:null},0,100000)).toBe(43200);});
 it('accepts no active session and rejects fabricated invalid durations',()=>{expect(studyTimer.parse({active:null}).active).toBeNull();expect(()=>studyTimer.parse({active:{id:'a',elapsedSeconds:-1,pausedAt:null,course:null}})).toThrow();});
});
