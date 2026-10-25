import {describe,expect,it} from 'vitest';
import {safePhoneNumber} from '../src/phone';
describe('explicit customer phone dialing',()=>{
 it('normalizes Persian digits and common display punctuation',()=>expect(safePhoneNumber('+۹۸ (۹۱۲) ۳۴۵-۶۷۸۹')).toBe('+989123456789'));
 it.each(['tel:+123456','*21*12345#','12345;911','12345,911','12345?x=1','+12','12345\n#'])('rejects executable or invalid dial strings %s',value=>expect(safePhoneNumber(value)).toBeNull());
});
