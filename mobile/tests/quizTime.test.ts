import {it,expect} from 'vitest';
import {quizSecondsLeft} from '../src/quizTime';
it('counts from server time and bounds expired or malformed deadlines',()=>{
 expect(quizSecondsLeft('2026-10-14T10:01:00Z','2026-10-14T10:00:00Z',5000)).toBe(55);
 expect(quizSecondsLeft('2026-10-14T10:01:00Z','2026-10-14T10:00:00Z',70000)).toBe(0);
 expect(quizSecondsLeft('invalid','2026-10-14T10:00:00Z',0)).toBe(0);
 expect(quizSecondsLeft(null,'2026-10-14T10:00:00Z',0)).toBeNull();
});
