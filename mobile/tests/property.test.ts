import {describe,expect,it} from 'vitest';
import {normalizeWholeAmount} from '../src/property';
describe('whole-unit property amounts',()=>{
 it.each([['۱۲٬۳۴۵٬۶۷۸','12345678'],['١٢٣٤','1234'],['999,999,999,999,999','999999999999999'],['0000','0']])('preserves exact amount %s',(raw,expected)=>expect(normalizeWholeAmount(raw)).toBe(expected));
 it.each(['-1','1.5','1,5','12,34','۱٫۵','1000000000000000','abc'])('rejects ambiguous or out-of-range amount %s',raw=>expect(()=>normalizeWholeAmount(raw)).toThrow());
});
