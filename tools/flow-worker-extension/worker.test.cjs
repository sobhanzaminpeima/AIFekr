const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'worker.js'),'utf8');
function harness({crashStart=false,stored}={}){
 const data=stored || {settings:{enabled:true,workerId:'pc-test',token:'test-only',projectUrl:'https://flow.google.com/project/test'}};
 const calls=[],events={};let state='GENERATE';
 const chrome={storage:{local:{setAccessLevel:async x=>calls.push(['access',x]),get:async key=>({[key]:structuredClone(data[key])}),set:async x=>Object.assign(data,structuredClone(x))}},
 tabs:{query:async()=>[{id:1,url:data.settings.projectUrl}],sendMessage:async(_id,m)=>{calls.push(['ui',m.action]);return {ok:true,baseline:[],url:null};}},
 alarms:{get:async()=>null,create:async()=>{},onAlarm:{addListener:f=>events.alarm=f}},runtime:{onInstalled:{addListener:()=>{}},onStartup:{addListener:()=>{}},onMessage:{addListener:f=>events.message=f},openOptionsPage:()=>{}},action:{onClicked:{addListener:()=>{}}}};
 const context=vm.createContext({chrome,URL,AbortSignal,Blob,Date,console,fetch:async(url,init)=>{
 const action=new URL(url).searchParams.get('action');calls.push(['api',action]);
 if(action==='start'){state='RECOVER_OUTPUT';if(crashStart)throw Error('network lost after commit');}
 return {ok:true,json:async()=>action==='health'?{ok:true,protocol:1,generationStarted:false}:action==='claim'?{task:{id:'scene-1',leaseToken:'lease',action:state,model:'flow-image',prompt:'test'}}:{}};
 }});vm.runInContext(source,context);
 return {data,calls,run:()=>vm.runInContext('tick()',context),health:()=>new Promise(resolve=>events.message({action:'health'},{},resolve))};
}
test('stores the journal before submission and clicks only once',async()=>{
 const h=harness();await h.run();await h.run();
 assert.equal(h.calls.filter(c=>c[0]==='ui'&&c[1]==='generate').length,1);
 assert.ok(h.data.journal['scene-1'].started);
 assert.equal(h.calls[0][1].accessLevel,'TRUSTED_CONTEXTS');
});
test('uncertain server acknowledgement recovers instead of clicking Generate',async()=>{
 const h=harness({crashStart:true});await h.run();await h.run();
 assert.equal(h.calls.filter(c=>c[0]==='ui'&&c[1]==='generate').length,0);
 assert.ok(h.calls.some(c=>c[0]==='ui'&&c[1]==='recover'));
});
test('a restarted worker refuses a repeat generation when a local start exists',async()=>{
 const h=harness();await h.run();const restarted=harness({stored:h.data});await restarted.run();
 assert.equal(restarted.calls.filter(c=>c[0]==='ui'&&c[1]==='generate').length,0);
 assert.equal(h.data.settings.enabled,false);
 assert.equal(h.data.status.code,'OUTPUT_UNCERTAIN');
});
test('disabled worker can check connectivity without claiming or generating',async()=>{
 const h=harness({stored:{settings:{enabled:false,token:'x'.repeat(32),projectUrl:'https://flow.google.com/project/test'}}});
 const result=await h.health();
 assert.equal(result.code,'CONNECTED_DISABLED_SAFE');
 assert.deepEqual(h.calls.filter(c=>c[0]==='api'),[['api','health']]);
 assert.equal(h.calls.filter(c=>c[0]==='ui').length,0);
 assert.equal(h.data.settings.enabled,false);
 assert.equal(h.data.journal,undefined);
});
