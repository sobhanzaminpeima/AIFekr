import {beforeEach,describe,expect,it,vi} from 'vitest';
import {changeOfflineState,readOfflineState,removeVault} from '../src/offlineVault';
import {queuePlannerMutation,submitPlannerMutation,syncPlannerQueue} from '../src/offlinePlanner';
import {ApiError} from '../src/api';
const state=vi.hoisted(()=>({owner:'session-alpha',generation:0,allowed:true,request:vi.fn(),files:new Map<string,Uint8Array>(),secrets:new Map<string,string>(),gate:null as Promise<void>|null,encrypted:0}));
vi.mock('../src/api',()=>({offlineIdentity:async()=>{const generation=state.generation;return state.allowed?{id:state.owner,valid:()=>state.generation===generation}:null;},request:state.request,ApiError:class extends Error{constructor(public status:number,message:string){super(message);}}}));
vi.mock('expo-secure-store',()=>({WHEN_UNLOCKED_THIS_DEVICE_ONLY:1,getItemAsync:async(key:string)=>state.secrets.get(key)||null,setItemAsync:async(key:string,value:string)=>{state.secrets.set(key,value);},deleteItemAsync:async(key:string)=>{state.secrets.delete(key);}}));
vi.mock('expo-file-system',()=>({Paths:{document:'private'},File:class{uri:string;constructor(...parts:string[]){this.uri=parts.join('/');}get exists(){return state.files.has(this.uri);}get size(){return state.files.get(this.uri)?.byteLength||0;}create(){state.files.set(this.uri,new Uint8Array());}write(bytes:Uint8Array){state.files.set(this.uri,new Uint8Array(bytes));}async bytes(){return new Uint8Array(state.files.get(this.uri)!);}delete(){state.files.delete(this.uri);}async move(target:{uri:string}){state.files.set(target.uri,state.files.get(this.uri)!);state.files.delete(this.uri);this.uri=target.uri;}}}));
// Native crypto boundary is represented by real Node AES-GCM, not plaintext stubs.
vi.mock('expo-crypto',async()=>{const {randomBytes,createCipheriv,createDecipheriv}=await import('node:crypto');class Key{constructor(public data:Uint8Array){}static async generate(){return new Key(randomBytes(32));}static async import(hex:string){return new Key(Buffer.from(hex,'hex'));}async encoded(){return Buffer.from(this.data).toString('hex');}}return {AESEncryptionKey:Key,AESSealedData:{fromCombined:(data:Uint8Array)=>({data})},aesEncryptAsync:async(plain:Uint8Array,key:Key,options:{additionalData:Uint8Array})=>{state.encrypted++;if(state.gate)await state.gate;const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key.data,nonce);cipher.setAAD(options.additionalData);const data=Buffer.concat([nonce,cipher.update(plain),cipher.final(),cipher.getAuthTag()]);return {combined:async()=>data};},aesDecryptAsync:async(sealed:{data:Uint8Array},key:Key,options:{additionalData:Uint8Array})=>{const data=Buffer.from(sealed.data),cipher=createDecipheriv('aes-256-gcm',key.data,data.subarray(0,12));cipher.setAAD(options.additionalData);cipher.setAuthTag(data.subarray(-16));return Buffer.concat([cipher.update(data.subarray(12,-16)),cipher.final()]);}};});
beforeEach(()=>{state.owner='session-alpha';state.generation++;state.allowed=true;state.files.clear();state.secrets.clear();state.request.mockReset();state.gate=null;state.encrypted=0;});
const payload={action:'exam.create',courseId:'course-fixture',title:'Offline exam',examAt:'2026-12-01T12:00:00.000Z',requestKey:'planner_offline_fixture123456'};
describe('encrypted offline study storage and synchronization',()=>{
 it('stores Persian text only as authenticated ciphertext and scopes it to its session',async()=>{
  const text='جزوهٔ خصوصی 🌍';await changeOfflineState(value=>{value.documents.push({id:'material',courseId:'course',kind:'material',title:'Fixture',text,savedAt:new Date().toISOString()});});
  expect((await readOfflineState())?.documents[0].text).toBe(text);expect([...state.files.values()].every(bytes=>!new TextDecoder().decode(bytes).includes(text))).toBe(true);
  state.owner='session-beta';state.generation++;expect((await readOfflineState())?.documents).toEqual([]);await removeVault('session-alpha');expect(state.files.size).toBe(0);expect(state.secrets.size).toBe(0);
 });
 it('rejects tampered ciphertext without silently discarding pending data',async()=>{
  await queuePlannerMutation(payload);const bytes=[...state.files.values()][0];bytes[15]^=255;await expect(readOfflineState()).rejects.toThrow();expect(state.files.size).toBe(1);
 });
 it('deduplicates a persisted pending intent and uses the original key after reconnecting',async()=>{
  await queuePlannerMutation(payload);await queuePlannerMutation({...payload,requestKey:'planner_different_nonce123456'});expect((await readOfflineState())?.queue).toHaveLength(1);
  state.request.mockRejectedValueOnce(Error('Offline'));await syncPlannerQueue('fa');expect((await readOfflineState())?.queue).toHaveLength(1);
  state.request.mockResolvedValue({ok:true});await syncPlannerQueue('fa');expect((await readOfflineState())?.queue).toHaveLength(0);expect(JSON.parse(state.request.mock.calls[1][2].body).requestKey).toBe(payload.requestKey);
 });
 it('retains a stale-write conflict and does not overwrite the server on later sync',async()=>{
  state.request.mockRejectedValue(new ApiError(409,'Fixture conflict'));await expect(submitPlannerMutation(payload,'en')).rejects.toThrow();expect((await readOfflineState())?.queue[0].status).toBe('conflict');await syncPlannerQueue('en');expect(state.request).toHaveBeenCalledTimes(1);
 });
 it('rejects AI/payment actions before writing or sending them',async()=>{
  await expect(queuePlannerMutation({...payload,action:'media.generate'})).rejects.toThrow();expect(state.files.size).toBe(0);expect(state.request).not.toHaveBeenCalled();
 });
 it('binds offline property changes to their original workspace and never queues payment actions',async()=>{
  const property={action:'create',context:{workspaceUserId:'owner',businessId:'business-a'},data:{title:'Offline rental'},requestKey:'property_offline_fixture123456'};
  await queuePlannerMutation(property);state.request.mockResolvedValue({id:'fixture'});await syncPlannerQueue('en');expect(state.request.mock.calls[0][0]).toBe('/api/mobile/v1/properties');expect(JSON.parse(state.request.mock.calls[0][2].body).context.businessId).toBe('business-a');
  await expect(queuePlannerMutation({...property,action:'pay'})).rejects.toThrow();expect(state.request).toHaveBeenCalledTimes(1);
 });
 it('prevents a session change during encryption from restoring old account data',async()=>{
  let release!:()=>void;state.gate=new Promise<void>(resolve=>{release=resolve;});const pending=queuePlannerMutation(payload);await vi.waitFor(()=>expect(state.encrypted).toBe(1));state.generation++;const remove=removeVault(state.owner);release();await expect(pending).rejects.toThrow('Session changed');await remove;expect(state.files.size).toBe(0);expect(state.secrets.size).toBe(0);
 });
});
