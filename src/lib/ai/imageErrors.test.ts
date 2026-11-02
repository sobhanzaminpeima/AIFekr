import {describe,it,expect} from 'vitest';
import {ImageSafetyError,imageProviderError} from './imageErrors';
describe('image provider failures',()=>{
 it('recognizes a safety rejection without leaking provider text',()=>{
  const error=imageProviderError(400,{message:'Your request was rejected as a result of our safety system. private input'});
  expect(error).toBeInstanceOf(ImageSafetyError);expect(error.message).toBe('IMAGE_SAFETY_REJECTED');
 });
 it('keeps quota and network/service responses separate from content rejections',()=>{
  expect(imageProviderError(429,{code:'insufficient_quota'})).not.toBeInstanceOf(ImageSafetyError);
  expect(imageProviderError(500,{message:'safety system'}).message).toBe('IMAGE_PROVIDER_HTTP_500');
 });
});
