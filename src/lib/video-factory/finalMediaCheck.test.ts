import {describe,it,expect} from 'vitest';
import {checkFinalMedia} from './finalMediaCheck';
describe('delivered media validation',()=>{
  const video={codec_type:'video'},audio={codec_type:'audio'};
  it('rejects a final file that lost narration during assembly',()=>{
    expect(()=>checkFinalMedia({format:{duration:'300'},streams:[video]},300,true)).toThrow('QC_NARRATION_MISSING');
  });
  it('rejects unavailable or invalid duration instead of allowing NaN through',()=>{
    for(const duration of [undefined,'N/A','NaN',Infinity,0])expect(()=>checkFinalMedia({format:{duration},streams:[video,audio]},300,true)).toThrow('QC_DURATION_FAILED');
  });
  it('accepts a narrated film and an explicitly silent storyboard',()=>{
    expect(()=>checkFinalMedia({format:{duration:'600'},streams:[video,audio]},600,true)).not.toThrow();
    expect(()=>checkFinalMedia({format:{duration:'300'},streams:[video]},300,false)).not.toThrow();
  });
});
