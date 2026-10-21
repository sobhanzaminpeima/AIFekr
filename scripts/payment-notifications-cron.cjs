// Runs via the VPS scheduler; secrets remain in the release environment.
require('@next/env').loadEnvConfig(process.cwd());
(async()=>{
 const result=await fetch('http://127.0.0.1:3000/api/cron/payment-notifications',{headers:{'x-cron-secret':process.env.CRON_SECRET||''},signal:AbortSignal.timeout(55000)});
 if(!result.ok)throw Error('Payment notification retry failed: '+result.status);
 console.log(new Date().toISOString(),await result.text());
})().catch(e=>{console.error(e.message);process.exitCode=1;});
