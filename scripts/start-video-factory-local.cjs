const fs=require('node:fs');const path=require('node:path');const {spawn}=require('node:child_process');
const root=process.cwd(),runtime=path.join(process.env.LOCALAPPDATA||path.join(root,'tmp'),'AIFekr','VideoFactory'),stateFile=path.join(runtime,'processes.json');
function alive(pid){try{process.kill(pid,0);return true;}catch{return false;}}
async function main(){fs.mkdirSync(runtime,{recursive:true});const previous=fs.existsSync(stateFile)?JSON.parse(fs.readFileSync(stateFile,'utf8')):{};if(previous.serverPid&&alive(previous.serverPid)){console.log('Local Video Factory processes are already running');return;}
 const origin='http://127.0.0.1:3147';try{await fetch(origin,{signal:AbortSignal.timeout(1000)});throw Error('Port 3147 is already occupied; refusing to attach a worker to an unknown server');}catch(e){if(e.message.startsWith('Port '))throw e;}
 function launch(args,name,env={}){const output=fs.openSync(path.join(runtime,name+'.log'),'a');const child=spawn(process.execPath,args,{cwd:root,env:{...process.env,...env},detached:true,windowsHide:true,stdio:['ignore',output,output]});child.unref();fs.closeSync(output);return child.pid;}
 const serverPid=launch(['node_modules/next/dist/bin/next','dev','-p','3147','-H','127.0.0.1'],'server',{NEXT_DIST_DIR:'.next-video-factory-local'});
 const workerPid=launch(['scripts/run-video-factory-worker.cjs','--watch','--local','--origin',origin],'worker');fs.writeFileSync(stateFile,JSON.stringify({serverPid,workerPid,origin,startedAt:new Date().toISOString(),paidSmokeTest:false},null,2));console.log(JSON.stringify({started:true,origin,serverPid,workerPid,policyUnchanged:true}));}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
