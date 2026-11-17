/* One checkpoint per invocation; schedule frequently with the existing deployment scheduler. */
require('@next/env').loadEnvConfig(process.cwd());
async function main() {
  const at=process.argv.indexOf('--origin');
  const origin = new URL(at>=0?process.argv[at+1]:process.env.APP_URL || "http://127.0.0.1:3000");
  if(process.argv.includes('--local') && !["localhost","127.0.0.1","[::1]"].includes(origin.hostname))throw Error('Local worker requires a loopback origin');
  if (origin.username || origin.password || (origin.protocol !== "https:" && !(origin.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)))) throw Error("Invalid application origin");
  if (!process.env.CRON_SECRET) throw Error("CRON_SECRET is required");
  const fixtureAt=process.argv.indexOf('--fixture-job');
  let path=process.argv.includes("--maintenance")?"/api/cron/video-factory-maintenance":"/api/cron/video-factory";
  if(fixtureAt>=0){
    const jobId=process.argv[fixtureAt+1];
    if(!jobId || jobId.startsWith('-') || process.argv.includes('--maintenance') || process.argv.includes('--watch'))throw Error('A fixture invocation requires one job ID and runs a single checkpoint');
    path='/api/cron/video-factory-flow-fixture?jobId='+encodeURIComponent(jobId);
  }
  const response = await fetch(new URL(path, origin), { method: "POST", redirect: "error", signal: AbortSignal.timeout(150000), headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } });
  if (!response.ok) throw Error(`Worker HTTP ${response.status}`);
  const result = await response.json();
  if(result.processed || !process.argv.includes('--watch'))console.log(process.argv.includes("--maintenance")?"Video Factory maintenance completed":result.processed ? "Video Factory checkpoint processed" : "No queued work");
}
async function run(){do{try{await main();}catch(error){console.error(error instanceof Error?error.message:"Worker failed");if(!process.argv.includes('--watch')){process.exitCode=1;return;}}if(!process.argv.includes('--watch'))return;await new Promise(resolve=>setTimeout(resolve,10000));}while(true);}
if(process.argv.includes('--fixture-job') && process.argv.includes('--watch')){
  console.error('Fixture runs support a single checkpoint only');
  process.exitCode=1;
}else run();
