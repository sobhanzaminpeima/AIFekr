import * as SecureStore from 'expo-secure-store';
import { z } from 'zod';
import type { Locale } from './i18n';

const key = 'aifekr.session.v2';
const session = z.object({ accessToken:z.string().min(1),refreshToken:z.string().min(1),expiresIn:z.number().positive(),refreshExpiresAt:z.string(),sessionId:z.string() });
const storedSession = session.extend({expiresAt:z.number()});
type Session = z.infer<typeof storedSession>;
let epoch = 0;
let refreshing:Promise<Session>|null = null;
let storageWrites:Promise<void> = Promise.resolve();
function writeStorage(action:()=>Promise<void>) {const task=storageWrites.then(action);storageWrites=task.catch(()=>{});return task;}
export const profile = z.object({ user: z.object({ name:z.string(), plan:z.string(), displayCredits:z.number().nonnegative(),accountType:z.string().optional() }) });
export const contacts = z.object({ contacts:z.array(z.object({ id:z.string(), name:z.string(), email:z.string().nullable().optional(), phone:z.string().nullable().optional() })) });
export class ApiError extends Error { constructor(public status:number, message:string) { super(message); } }
export function apiConfigurationError(locale:Locale):string|null {
  try{apiOrigin(process.env.EXPO_PUBLIC_API_URL,__DEV__);return null;}catch{return {fa:'این نسخه به بک‌اند متصل نشده است. نشانی سرور باید در تنظیمات ساخت اپ وارد و APK دوباره ساخته شود.',en:'This build has no valid backend connection. Configure the API address and rebuild the APK.',tr:'Bu derlemede geçerli sunucu bağlantısı yok. API adresini ayarlayıp APK dosyasını yeniden derleyin.'}[locale];}
}

export function apiOrigin(raw:string | undefined, development:boolean):string {
  if (!raw) throw new Error('EXPO_PUBLIC_API_URL is required');
  const url = new URL(raw);
  const local = ['localhost','127.0.0.1','[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(development && local && url.protocol === 'http:')) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('Use an HTTPS API origin');
  return url.origin;
}

async function readSession():Promise<Session|null> {
  await storageWrites;
  const raw=await SecureStore.getItemAsync(key); if(!raw)return null;
  try {return storedSession.parse(JSON.parse(raw));}catch{await clearSession();return null;}
}
async function clearSession() {
 const raw=await SecureStore.getItemAsync(key);let owner:string|undefined;try{owner=storedSession.parse(JSON.parse(raw||'null')).sessionId;}catch{/* Invalid or absent session. */}
 epoch++;
 await writeStorage(async()=>{
  const names=[key,...(owner?[`aifekr.quiz.${owner}`,`aifekr.offline.key.${owner}`,`aifekr.draft.${owner}.count`,...Array.from({length:40},(_,i)=>`aifekr.draft.${owner}.${i}`)]:[])];
  const results=await Promise.allSettled(names.map(name=>SecureStore.deleteItemAsync(name)));
  if(owner){const vault=await import('./offlineVault');await vault.removeVault(owner);}
  if(results.some(result=>result.status==='rejected'))throw Error('Device storage cleanup failed');
 });
}
async function saveSession(raw:unknown,expectedEpoch=epoch) {
  const data=session.parse(raw); const value={...data,expiresAt:Date.now()+data.expiresIn*1000};
  await writeStorage(async()=>{if(expectedEpoch!==epoch)throw new ApiError(401,'Session changed');await SecureStore.setItemAsync(key,JSON.stringify(value),{keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY});});return value;
}
async function refresh(current:Session,locale:Locale):Promise<Session> {
  if(refreshing)return refreshing;
  const started=epoch;
  refreshing=(async()=>{
    try {
      const response=await transport('/api/mobile/v1/session/refresh',locale,{method:'POST',body:JSON.stringify({refreshToken:current.refreshToken})},null);
      const raw=await response.json().catch(()=>null);
      if(!response.ok){if(response.status===401)await clearSession();throw new ApiError(response.status,'Session refresh failed');}
      if(started!==epoch)throw new ApiError(401,'Session changed');
      return await saveSession(raw,started);
    }finally{refreshing=null;}
  })();
  return refreshing;
}
async function transport(path:string,locale:Locale,init:RequestInit,current:Session|null) {
  const configurationError=apiConfigurationError(locale);if(configurationError)throw new ApiError(503,configurationError);
  const origin = apiOrigin(process.env.EXPO_PUBLIC_API_URL, __DEV__);
  if (!path.startsWith('/api/') || path.includes('..')) throw new Error('Invalid API path');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  const abort=()=>controller.abort();init.signal?.addEventListener('abort',abort,{once:true});
  if(init.signal?.aborted)controller.abort();
  try {
    const headers=new Headers(init.headers);if(init.body instanceof FormData)headers.delete('Content-Type');else headers.set('Content-Type','application/json');headers.set('Cookie',`lang=${locale}`);
    if(current)headers.set('Authorization',`Bearer ${current.accessToken}`);else headers.delete('Authorization');
    return await fetch(origin+path,{...init,credentials:'omit',redirect:'error',signal:init.signal||controller.signal,headers});
  }finally{clearTimeout(timer);init.signal?.removeEventListener('abort',abort);}
}
export async function authorizedFetch(path:string,locale:Locale,init:RequestInit={}) {
  const started=epoch;
  let current=await readSession();if(!current)throw new ApiError(401,'Session expired');
  if(current.expiresAt<Date.now()+30000)current=await refresh(current,locale);
  if(started!==epoch)throw new ApiError(401,'Session changed');
  let response=await transport(path,locale,init,current);
  if(response.status===401&&(!init.method||init.method==='GET')){
    current=await refresh(current,locale);response=await transport(path,locale,init,current);
  }
  if(response.status===401)await clearSession();
  return response;
}
export async function request(path:string, locale:Locale, init:RequestInit = {}, authenticated = true):Promise<unknown> {
    const response=authenticated?await authorizedFetch(path,locale,init):await transport(path,locale,init,null);
    const data:unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const parsed = z.object({ error:z.string() }).safeParse(data);
      throw new ApiError(response.status, parsed.success ? parsed.data.error : `HTTP ${response.status}`);
    }
    return data;
}
export async function signIn(email:string, password:string, locale:Locale) {
  const normalizedEmail=email.trim();if(!z.email().safeParse(normalizedEmail).success||!password)throw new ApiError(400,{fa:'ایمیل معتبر و رمز عبور را وارد کنید.',en:'Enter a valid email and password.',tr:'Geçerli e-posta ve şifre girin.'}[locale]);
  const started=++epoch;await saveSession(await request('/api/mobile/v1/session',locale,{method:'POST',body:JSON.stringify({email:normalizedEmail,password})},false),started);
}
/** Phone sign-in / sign-up: the server sends an SMS code through the same gateway as the web. */
export async function requestOtp(phone:string,locale:Locale){
  const raw=await request('/api/mobile/v1/session/otp',locale,{method:'POST',body:JSON.stringify({phone})},false);
  return z.object({phone:z.string(),resendAfterSec:z.number().int().positive(),devCode:z.string().optional()}).parse(raw);
}
/** Verifies the code and stores a native session; `needsProfile` means a brand-new account without a name. */
export async function verifyOtp(phone:string,code:string,locale:Locale){
  const started=++epoch;const raw=await request('/api/mobile/v1/session/otp/verify',locale,{method:'POST',body:JSON.stringify({phone,code})},false);
  await saveSession(raw,started);
  return z.object({needsProfile:z.boolean().default(false)}).parse(raw).needsProfile;
}
export const hasSession = async () => {await SecureStore.deleteItemAsync('aifekr.access.v1');return !!(await readSession());};
export async function logout(locale:Locale='en') {
  const current=await readSession();let cleanupFailed=false;try{await clearSession();}catch{cleanupFailed=true;}
  const cleanup=cleanupFailed?{localCleared:false}:{};
  if(!current)return {revoked:true,...cleanup};
  try {const response=await transport('/api/mobile/v1/session',locale,{method:'DELETE',body:JSON.stringify({refreshToken:current.refreshToken})},null);return {revoked:response.ok,...cleanup};}catch{return {revoked:false,...cleanup};}
}
export async function readDraft(){const current=await readSession();if(!current)return null;const count=Number(await SecureStore.getItemAsync(`aifekr.draft.${current.sessionId}.count`));if(!Number.isInteger(count)||count<0||count>40)return {sessionId:current.sessionId,text:''};const values=await Promise.all(Array.from({length:count},(_,i)=>SecureStore.getItemAsync(`aifekr.draft.${current.sessionId}.${i}`)));return {sessionId:current.sessionId,text:values.map(v=>v||'').join('').slice(0,12000)};}
export async function saveDraft(text:string,owner:string){const started=epoch,current=await readSession();if(!current||current.sessionId!==owner)return;const points=Array.from(text.slice(0,12000)),chunks:string[]=[];for(let i=0;i<points.length;i+=400)chunks.push(points.slice(i,i+400).join(''));await writeStorage(async()=>{if(started!==epoch)return;const previous=Number(await SecureStore.getItemAsync(`aifekr.draft.${owner}.count`));for(let i=0;i<chunks.length;i++)await SecureStore.setItemAsync(`aifekr.draft.${owner}.${i}`,chunks[i],{keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY});for(let i=chunks.length;i<Math.min(previous,40);i++)await SecureStore.deleteItemAsync(`aifekr.draft.${owner}.${i}`);await SecureStore.setItemAsync(`aifekr.draft.${owner}.count`,String(chunks.length),{keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY});});}
const offlineQuiz=z.object({quizId:z.string().min(1).max(100),quizHash:z.string().length(64),serverRevision:z.number().int().nonnegative(),answers:z.array(z.number().int().min(0).max(3).nullable()).max(100)});
export async function saveOfflineQuiz(value:z.infer<typeof offlineQuiz>){
 const data=offlineQuiz.parse(value),started=epoch,current=await readSession();if(!current)return;
 await writeStorage(async()=>{if(started!==epoch)return;await SecureStore.setItemAsync(`aifekr.quiz.${current.sessionId}`,JSON.stringify(data),{keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY});});
}
export async function readOfflineQuiz(){
 const started=epoch,current=await readSession();if(!current)return null;
 const raw=await SecureStore.getItemAsync(`aifekr.quiz.${current.sessionId}`);if(started!==epoch||!raw)return null;
 try{return offlineQuiz.parse(JSON.parse(raw));}catch{return null;}
}
export async function offlineIdentity(){const started=epoch,current=await readSession();const expiry=Date.parse(current?.refreshExpiresAt||'');if(!current||!Number.isFinite(expiry)||expiry<=Date.now())return null;return {id:current.sessionId,valid:()=>epoch===started};}
