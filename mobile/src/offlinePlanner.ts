import {ApiError,offlineIdentity,request} from './api';
import {changeOfflineState,readOfflineState,type OfflineState} from './offlineVault';
import type {Locale} from './i18n';
const listeners=new Set<()=>void>();
export function onOfflineChange(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}
export const notifyOfflineChange=()=>listeners.forEach(listener=>listener());
function comparable(value:Record<string,unknown>){return JSON.stringify(Object.fromEntries(Object.entries(value).filter(([key])=>key!=='requestKey').sort(([a],[b])=>a.localeCompare(b))));}
export async function queuePlannerMutation(payload:Record<string,unknown>){
 let admitted:OfflineState['queue'][number]|undefined,created=false;
 await changeOfflineState(state=>{admitted=state.queue.find(row=>comparable(row.body)===comparable(payload));if(!admitted){admitted={body:payload as OfflineState['queue'][number]['body'],createdAt:new Date().toISOString(),status:'pending'};state.queue.push(admitted);created=true;}});if(created)notifyOfflineChange();return admitted!;
}
export async function discardPlannerMutation(key:string){await changeOfflineState(state=>{state.queue=state.queue.filter(row=>row.body.requestKey!==key);});notifyOfflineChange();}
export async function submitPlannerMutation(payload:Record<string,unknown>,locale:Locale){
 const identity=await offlineIdentity();if(!identity)throw new ApiError(401,'Session expired');
 const admitted=await queuePlannerMutation(payload);
 if(!identity.valid())throw new ApiError(401,'Session changed before synchronization');
 if(admitted.status==='conflict')throw new ApiError(409,'Resolve the queued conflict before retrying');
 try{const route=admitted.body.requestKey.startsWith('property_')?'/api/mobile/v1/properties':'/api/mobile/v1/student/planner';const result=await request(route,locale,{method:'POST',body:JSON.stringify(admitted.body)});if(identity.valid())await discardPlannerMutation(admitted.body.requestKey);return result;}
 catch(error){if(identity.valid()&&error instanceof ApiError&&[400,404,409].includes(error.status)){await changeOfflineState(state=>{const row=state.queue.find(item=>item.body.requestKey===admitted.body.requestKey);if(row){row.status='conflict';row.error=String(error.status);}});notifyOfflineChange();}throw error;}
}
let syncing:Promise<void>|null=null;
export async function syncPlannerQueue(locale:Locale){if(syncing)return syncing;syncing=(async()=>{const identity=await offlineIdentity();if(!identity)return;const state=await readOfflineState();for(const item of state?.queue||[]){if(!identity.valid())break;if(item.status!=='pending')continue;try{await submitPlannerMutation(item.body,locale);}catch(error){if(!(error instanceof ApiError)||![400,404,409].includes(error.status))break;}}})().finally(()=>{syncing=null;});return syncing;}
export async function clearOfflineCopies(){await changeOfflineState(state=>{state.documents=[];state.planners={};delete state.properties;});notifyOfflineChange();}
