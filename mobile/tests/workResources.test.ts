import {describe,it,expect} from 'vitest';
import {parseResources} from '../src/workResources';
describe('verified module projections',()=>{
 it('shows probability without inventing currency for an unlabelled deal value',()=>{const result=parseResources('deals',{deals:[{id:'d',title:'Deal',status:'open',value:250,probability:50}]},'en')[0].detail;expect(result).toContain('50%');expect(result).not.toContain('250');});
 it('preserves nullable task deadlines',()=>{expect(parseResources('tasks',{tasks:[{id:'t',title:'Follow up',status:'pending',dueDate:null}]},'en')[0].date).toBeNull();});
 it('does not convert malformed or unauthorized payloads into empty success',()=>{expect(()=>parseResources('courses',{error:'Access denied'},'fa')).toThrow();});
 it('shows the real course associated with an exam',()=>{expect(parseResources('exams',{exams:[{id:'e',title:'Midterm',examAt:'2026-10-15T10:00:00Z',course:{name:'Biology'}}]},'en')[0].detail).toBe('Biology');});
});
