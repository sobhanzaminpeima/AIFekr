import {AESEncryptionKey,AESSealedData,aesDecryptAsync,aesEncryptAsync} from 'expo-crypto';
import {File,Paths} from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import {z} from 'zod';
import {offlineIdentity} from './api';
export const offlineDocument=z.object({id:z.string().max(100),courseId:z.string().max(100),title:z.string().max(200),text:z.string().max(100000),kind:z.enum(['material','note','card']),savedAt:z.string()});
const mutation=z.object({requestKey:z.string().regex(/^planner_[a-zA-Z0-9_-]{8,100}$/),courseId:z.string().min(1).max(100),action:z.enum(['exam.create','exam.update','exam.delete','plan.generate','task.create','task.update','task.delete'])}).passthrough();
const propertyMutation=z.object({requestKey:z.string().regex(/^property_[a-zA-Z0-9_-]{8,100}$/),action:z.enum(['create','update']),context:z.object({workspaceUserId:z.string(),businessId:z.string().nullable()}),data:z.record(z.string(),z.unknown())}).passthrough();
export const offlineSchema=z.object({version:z.literal(1),owner:z.string(),documents:z.array(offlineDocument).max(50),planners:z.record(z.string(),z.object({savedAt:z.string(),data:z.unknown()})),properties:z.object({savedAt:z.string(),data:z.unknown()}).optional(),queue:z.array(z.object({body:z.union([mutation,propertyMutation]),createdAt:z.string(),status:z.enum(['pending','conflict']),error:z.string().optional()})).max(50)});
export type OfflineState=z.infer<typeof offlineSchema>;
let writes:Promise<unknown>=Promise.resolve();
function serial<T>(fn:()=>Promise<T>):Promise<T>{const task=writes.then(fn);writes=task.then(()=>undefined,()=>undefined);return task;}
function file(owner:string,suffix='bin'){if(!/^[a-zA-Z0-9_-]{1,100}$/.test(owner))throw Error('Invalid offline owner');return new File(Paths.document,`aifekr-offline-${owner}.${suffix}`);}
const keyName=(owner:string)=>`aifekr.offline.key.${owner}`;
async function load(owner:string):Promise<OfflineState>{
 const source=file(owner),key=await SecureStore.getItemAsync(keyName(owner));
 if(!source.exists)return {version:1,owner,documents:[],planners:{},queue:[]};
 if(!key)throw Error('Offline key is unavailable; sign in again or remove saved offline data');
 if(source.size>4*1024*1024)throw Error('Offline storage exceeds its limit');
 const sealed=AESSealedData.fromCombined(await source.bytes());
 const bytes=await aesDecryptAsync(sealed,await AESEncryptionKey.import(key,'hex'),{additionalData:new TextEncoder().encode(owner)});
 const state=offlineSchema.parse(JSON.parse(new TextDecoder().decode(bytes)));if(state.owner!==owner)throw Error('Offline owner mismatch');return state;
}
export async function readOfflineState(){const identity=await offlineIdentity();if(!identity)return null;return serial(async()=>{const state=await load(identity.id);return identity.valid()?state:null;});}
export async function changeOfflineState(change:(state:OfflineState)=>void){
 const identity=await offlineIdentity();if(!identity)throw Error('Sign in to use offline storage');
 return serial(async()=>{
  const state=await load(identity.id);if(!identity.valid())throw Error('Session changed');change(state);const bytes=new TextEncoder().encode(JSON.stringify(offlineSchema.parse(state)));
  if(bytes.byteLength>3*1024*1024||Object.keys(state.planners).length>10)throw Error('Offline storage limit reached; remove saved items first');
  const encoded=await SecureStore.getItemAsync(keyName(identity.id));const key=encoded?await AESEncryptionKey.import(encoded,'hex'):await AESEncryptionKey.generate();
  if(!identity.valid())throw Error('Session changed');
  if(!encoded)await SecureStore.setItemAsync(keyName(identity.id),await key.encoded('hex'),{keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY});
  const sealed=await aesEncryptAsync(bytes,key,{additionalData:new TextEncoder().encode(identity.id)});const encrypted=await sealed.combined();
  if(!identity.valid())throw Error('Session changed');
  const pending=file(identity.id,'tmp');try{pending.create({overwrite:true});pending.write(encrypted);await pending.move(file(identity.id),{overwrite:true});}finally{if(pending.exists&&pending.uri.endsWith('.tmp'))pending.delete();}
  if(!identity.valid())throw Error('Session changed');return state;
 });
}
export async function removeVault(owner:string){return serial(async()=>{await SecureStore.deleteItemAsync(keyName(owner));for(const suffix of ['bin','tmp']){const existing=file(owner,suffix);if(existing.exists)existing.delete();}});}
