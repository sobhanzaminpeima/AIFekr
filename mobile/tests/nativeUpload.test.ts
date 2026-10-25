import {describe,it,expect,vi} from 'vitest';
import {appendNativeFile} from '../src/nativeUpload';
describe('React Native file transport',()=>{
 it('passes a URI file descriptor without browser Blob or unsupported set APIs',()=>{const append=vi.fn();appendNativeFile({append} as unknown as FormData,'file:///cache/notes.pdf','notes.pdf','application/pdf');expect(append).toHaveBeenCalledWith('file',{uri:'file:///cache/notes.pdf',name:'notes.pdf',type:'application/pdf'});});
 it('rejects network URLs as device file descriptors',()=>{expect(()=>appendNativeFile({append:vi.fn()} as unknown as FormData,'https://example.test/file','file','application/pdf')).toThrow();});
});
