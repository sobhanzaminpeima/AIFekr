import {beforeEach,describe,expect,it,vi} from 'vitest';
import {z} from 'zod';
const {model}=vi.hoisted(()=>({model:vi.fn()}));
vi.mock('@/lib/ai/router',()=>({routedStreamChat:model}));
import {structured} from './provider';
beforeEach(()=>{model.mockReset();});
describe('structured educational generation',()=>{
 it('repairs malformed flashcard item containers without losing the rejected educational draft',async()=>{
  const schema=z.object({blocks:z.array(z.object({type:z.literal('flashcards'),items:z.array(z.string())}))});
  const rejected={blocks:[{type:'flashcards',items:{question:'What should be evaluated?',answer:'Held-out examples'}}]},valid={blocks:[{type:'flashcards',items:['What should be evaluated?::Held-out examples']}]};
  model.mockImplementationOnce(async(_messages,_system,chunk)=>{chunk(JSON.stringify(rejected));return {id:'provider',model:'model'};}).mockImplementationOnce(async(messages,system,chunk)=>{expect(system).toContain('JSON Schema');expect(system).toContain('expected array');expect(JSON.parse(messages[0].content).rejectedOutput).toEqual(rejected);chunk(JSON.stringify(valid));return {id:'provider',model:'model'};});
  expect((await structured(schema,'Generate reviewed flashcards',{lesson:'Evaluation'},Date.now()+10000)).value).toEqual(valid);expect(model).toHaveBeenCalledTimes(2);
 });
 it('rejects unrepaired output after a bounded retry',async()=>{
  model.mockImplementation(async(_messages,_system,chunk)=>{chunk('{"items":{}}');return {id:'provider',model:'model'};});
  await expect(structured(z.object({items:z.array(z.string())}),'Generate strings',{},Date.now()+10000)).rejects.toBeInstanceOf(z.ZodError);expect(model).toHaveBeenCalledTimes(2);
 });
});
