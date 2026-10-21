// Select the live release; never log credentials or recipient details.
const path=require("node:path");
const {execFileSync}=require("node:child_process");
(async()=>{
  const app=JSON.parse(execFileSync("pm2",["jlist"],{encoding:"utf8",maxBuffer:4*1024*1024})).find(p=>p.name==="ai-platform");
  if(!app||app.pm2_env.status!=="online")throw Error("Application unavailable");
  require(path.join(app.pm2_env.pm_cwd,"node_modules/@next/env")).loadEnvConfig(app.pm2_env.pm_cwd);
  const response=await fetch("http://127.0.0.1:3000/api/cron/signup-notifications",{method:"POST",headers:{"x-cron-secret":process.env.CRON_SECRET||""},signal:AbortSignal.timeout(50000)});
  if(!response.ok)throw Error("Signup notification worker HTTP "+response.status);
  const result=await response.json();
  if(result.sent)console.log("Signup alerts sent:",result.sent);
  if(!result.configured)console.error("Signup notification email configuration missing");
})().catch(e=>{console.error(e.message);process.exitCode=1;});
