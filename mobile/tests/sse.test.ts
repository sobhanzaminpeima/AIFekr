import {describe,it,expect} from 'vitest';
import {SseParser,displayChatText} from '../src/sse';
describe('chat stream',()=>{
 it('handles split Unicode JSON frames and completion',()=>{const p=new SseParser();expect(p.push('data: {"text":"سل')).toEqual([]);expect(p.push('ام"}\r\n\r\ndata: [DONE]\n\n')).toEqual([{text:'سلام'}]);expect(p.done).toBe(true);});
 it('preserves reset and server error events',()=>{expect(new SseParser().push('data: {"reset":true}\n\ndata: {"error":"provider failed"}\n\n')).toEqual([{reset:true},{error:'provider failed'}]);});
 it('rejects malformed payloads and oversized incomplete events',()=>{expect(()=>new SseParser().push('data: {"text":7}\n\n')).toThrow();expect(()=>new SseParser().push('x'.repeat(1048577))).toThrow();});
 it('hides suggestion markup even when incompletely streamed',()=>{expect(displayChatText('Answer<SUGGESTIONS>["next"')).toBe('Answer');});
});
