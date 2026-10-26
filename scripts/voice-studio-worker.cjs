require('@next/env').loadEnvConfig(process.cwd());
if(!process.env.CRON_SECRET)throw Error('CRON_SECRET is required');
const base=process.env.VOICE_STUDIO_WORKER_URL||'http://127.0.0.1:3000';
let stopped=false;process.on('SIGTERM',()=>{stopped=true;});process.on('SIGINT',()=>{stopped=true;});
(async()=>{while(!stopped){try{const r=await fetch(base+'/api/cron/voice-studio',{method:'POST',headers:{authorization:`Bearer ${process.env.CRON_SECRET}`},signal:AbortSignal.timeout(140000)});await r.body?.cancel();if(!r.ok)console.error('voice_worker_http',r.status);}catch{console.error('voice_worker_unreachable');}if(!stopped)await new Promise(r=>setTimeout(r,5000));}})();
