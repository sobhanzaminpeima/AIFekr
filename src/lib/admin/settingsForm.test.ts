import {describe,it,expect} from 'vitest';
import {sectionSettings} from './settingsForm';
describe('admin settings sections',()=>{
 it('does not post unrelated provider caches or credentials while changing language',()=>{
  expect(sectionSettings([{key:'default_language',default:'fa'}],{default_language:'tr','voiceStudioPresets:user:personal':'[]',voiceStudioSecret:'private'})).toEqual({default_language:'tr'});
 });
});
