import {describe,it,expect} from 'vitest';
import {publicRequestResult} from './requestResult';
describe('public request result',()=>{
 it('hides pending and refunded reservation details',()=>{for(const status of ['RUNNING','PROVIDER_PENDING','REFUNDED'])expect(publicRequestResult(status,JSON.stringify({reservation:{payerId:'private'}}))).toBeNull();});
 it('removes ledger and provider job identifiers from completed media',()=>{expect(publicRequestResult('COMPLETED',JSON.stringify({kind:'media',type:'image',provider:'openai',credits:2,output:['https://example.com/a'],status:'succeeded',reservation:{payerId:'private'},predictionId:'private'}))).toEqual({type:'image',provider:'openai',credits:2,output:['https://example.com/a'],status:'succeeded'});});
 it('preserves completed chat and transcript results and tolerates corrupt JSON',()=>{expect(publicRequestResult('COMPLETED','{"text":"hello"}')).toEqual({text:'hello'});expect(publicRequestResult('COMPLETED','broken')).toBeNull();});
});
