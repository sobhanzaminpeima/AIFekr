import {describe,expect,it,vi} from 'vitest';
import {parseBlocks} from '../src/ui/Markdown';
// vi.mock is hoisted above the imports, so the parser loads without React Native.
vi.mock('react-native',()=>({ScrollView:'ScrollView',Text:'Text',View:'View'}));

describe('FIKA markdown blocks',()=>{
 it('splits headings, lists, quotes and paragraphs',()=>{
  expect(parseBlocks('# عنوان\n\nیک پاراگراف\nادامه\n- اول\n* دوم\n2. سوم\n> نقل')).toEqual([
   {kind:'h',text:'عنوان'},{kind:'p',text:'یک پاراگراف ادامه'},{kind:'li',text:'اول'},{kind:'li',text:'دوم'},{kind:'ol',text:'سوم',n:2},{kind:'quote',text:'نقل'},
  ]);
 });
 it('keeps fenced code verbatim, including markdown-looking lines',()=>{
  expect(parseBlocks('```ts\nconst a = 1\n- not a list\n```\nبعد')).toEqual([{kind:'code',text:'const a = 1\n- not a list'},{kind:'p',text:'بعد'}]);
 });
 it('closes an unterminated fence instead of dropping the code',()=>{
  expect(parseBlocks('```\nx = 1')).toEqual([{kind:'code',text:'x = 1'}]);
 });
 it('returns nothing for blank input',()=>{expect(parseBlocks('\n\n')).toEqual([]);});
});
