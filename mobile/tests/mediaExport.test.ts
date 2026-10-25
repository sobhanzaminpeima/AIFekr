import {describe,it,expect} from 'vitest';
import {boundedBytes,shareableMediaUrl} from '../src/mediaExport';
describe('media export guard',()=>{
 it.each(['http://assets.test/file','https://user:secret@assets.test/file','https://localhost/file','https://placehold.co/100','file:///private'])('rejects unsafe or simulated URL %s',url=>{expect(shareableMediaUrl(url)).toBe(false);});
 it('accepts real HTTPS assets and encoded images',()=>{expect(shareableMediaUrl('https://assets.example.test/image.png')).toBe(true);expect(shareableMediaUrl('data:image/png;base64,YQ==')).toBe(true);});
 it('enforces a byte cap when the server omits Content-Length',async()=>{await expect(boundedBytes(new Response('long response'),4)).rejects.toThrow('File too large');});
 it('reconstructs bounded bytes without modifying the media',async()=>{expect(Array.from(await boundedBytes(new Response(new Uint8Array([1,2,3])),4))).toEqual([1,2,3]);});
});
