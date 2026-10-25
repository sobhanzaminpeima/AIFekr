import {describe,it,expect} from 'vitest';
import {speechChunks} from '../src/speechText';
describe('voice response preparation',()=>{
 it('hides suggestions and code while preserving ordinary Persian',()=>{expect(speechChunks('سلام **دوست**\n```js\nsecret code\n```<SUGGESTIONS>["next"]</SUGGESTIONS>',200).join('')).toContain('سلام دوست');expect(speechChunks('Answer```code```<SUGGESTIONS>next',200).join('')).toBe('Answer');});
 it('keeps every chunk within the native speech limit',()=>{const chunks=speechChunks('long word '.repeat(30),32);expect(chunks.every(c=>c.length<=32)).toBe(true);expect(chunks.join(' ').replace(/\s+/g,' ').trim()).toBe('long word '.repeat(30).trim());});
 it('does not read embedded prompt payloads aloud',()=>{expect(speechChunks('Explanation<PROMPTBOX>{"content":"private"}</PROMPTBOX>',100)).toEqual(['Explanation']);});
});
