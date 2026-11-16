const ENDPOINT='https://aifekr.com/api/video-factory/flow-worker';
let running=false;
// Content scripts must never read the worker bearer token.
const ready=chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
async function settings(){return (await chrome.storage.local.get('settings')).settings;}
async function status(code){await chrome.storage.local.set({status:{code,at:Date.now()}});}
async function api(config,action,data,raw){
  const headers={Authorization:`Bearer ${config.token}`};
  if(raw){Object.assign(headers,{'Content-Type':'application/octet-stream','x-worker-id':config.workerId,'x-step-id':data.stepId,'x-lease-token':data.leaseToken});}
  else headers['Content-Type']='application/json';
  const response=await fetch(`${ENDPOINT}?action=${action}`,{method:'POST',headers,body:raw || JSON.stringify(data),redirect:'error',signal:AbortSignal.timeout(60000)});
  const result=await response.json();if(!response.ok)throw Error(result.code || 'SERVER_UNAVAILABLE');return result;
}
async function message(tab,action,payload){
  const response=await chrome.tabs.sendMessage(tab.id,{channel:'AIFEKR_FLOW',action,...payload});
  if(!response?.ok)throw Error(response?.code || 'UI_CHANGED');return response;
}
async function tick(){
  if(running)return;running=true;
  let task,config;
  try{
    await ready;
    config=await settings();if(!config?.enabled)return;
    const tabs=await chrome.tabs.query({url:'https://flow.google.com/project/*'});
    const candidates=tabs.filter(t=>t.url===config.projectUrl);
    if(candidates.length!==1){await status('OPEN_CONFIGURED_FLOW_PROJECT');return;}
    const tab=candidates[0];
    ({task}=await api(config,'claim',{workerId:config.workerId}));
    if(!task){await status('READY');return;}
    const journal=(await chrome.storage.local.get('journal')).journal || {};
    const claim={workerId:config.workerId,stepId:task.id,leaseToken:task.leaseToken};
    if(task.action==='GENERATE'){
      // A previous local START is never followed by another click, even if server state changed.
      if(journal[task.id]?.started)throw Error('OUTPUT_UNCERTAIN');
      const prepared=await message(tab,'prepare',{task,maxCredits:config.maxCredits || 0});
      journal[task.id]={baseline:prepared.baseline,started:true,at:Date.now()};
      await chrome.storage.local.set({journal});
      await api(config,'start',claim);
      await message(tab,'generate',{task});
      await status('GENERATING');return;
    }
    if(!journal[task.id])throw Error('OUTPUT_UNCERTAIN');
    const result=await message(tab,'recover',{baseline:journal[task.id].baseline});
    if(!result.url){
      if(Date.now()-journal[task.id].at>15*60*1000)throw Error('OUTPUT_UNCERTAIN');
      await status('WAITING_FOR_OUTPUT');return;
    }
    const url=new URL(result.url);
    if(url.protocol!=='https:' || url.hostname!=='flow-content.google' || !url.pathname.startsWith('/image/'))throw Error('DOWNLOAD_FAILED');
    const response=await fetch(url.href,{credentials:'include',redirect:'error',signal:AbortSignal.timeout(60000)});
    if(!response.ok)throw Error('DOWNLOAD_FAILED');
    const reader=response.body.getReader(),chunks=[];let size=0;
    while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>20000000){await reader.cancel();throw Error('DOWNLOAD_FAILED');}chunks.push(part.value);}
    const bytes=new Blob(chunks,{type:'application/octet-stream'});
    await api(config,'complete',claim,bytes);
    delete journal[task.id];await chrome.storage.local.set({journal});await status('DELIVERED');
  }catch(error){
    const code=String(error.message || 'WORKER_UNAVAILABLE');await status(code);
    if(task && config && ['UI_CHANGED','OUTPUT_UNCERTAIN','REFERENCE_REQUIRED','CREDITS_REQUIRED','DOWNLOAD_FAILED'].includes(code)){
      await chrome.storage.local.set({settings:{...config,enabled:false}});
      await api(config,'blocked',{workerId:config.workerId,stepId:task.id,leaseToken:task.leaseToken,code}).catch(()=>{});
    }
  }finally{running=false;}
}
chrome.runtime.onInstalled.addListener(()=>chrome.alarms.create('flow-poll',{periodInMinutes:.5}));
chrome.runtime.onStartup.addListener(()=>chrome.alarms.create('flow-poll',{periodInMinutes:.5}));
chrome.alarms.onAlarm.addListener(a=>{if(a.name==='flow-poll')void tick();});
chrome.action.onClicked.addListener(()=>chrome.runtime.openOptionsPage());
chrome.runtime.onMessage.addListener((m,_sender,reply)=>{
  if(m?.action==='tick'){void tick();return;}
  if(m?.action==='health'){
    (async()=>{
      await ready;
      const config=await settings();
      if(!config?.token || config.token.length<32)return {ok:false,code:'TOKEN_REQUIRED'};
      const result=await api(config,'health',{});
      if(result.protocol!==1 || result.generationStarted!==false)return {ok:false,code:'PROTOCOL_MISMATCH'};
      const tabs=await chrome.tabs.query({url:'https://flow.google.com/project/*'});
      const count=tabs.filter(t=>t.url===config.projectUrl).length;
      return {ok:true,code:count===1?'CONNECTED_DISABLED_SAFE':'OPEN_CONFIGURED_FLOW_PROJECT'};
    })().then(reply,()=>reply({ok:false,code:'CONNECTION_FAILED'}));
    return true;
  }
});
// Alarms may disappear after a browser restart; recreate on each worker startup.
void chrome.alarms.get('flow-poll').then(alarm=>{if(!alarm)return chrome.alarms.create('flow-poll',{periodInMinutes:.5});});
