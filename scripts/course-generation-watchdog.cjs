// Runs from the existing server scheduler. Uses the existing cron credential,
// never creates user sessions, and never prints provider keys or secrets.
const path = require('node:path');
const { execFileSync } = require('node:child_process');
async function main() {
  const processes = JSON.parse(execFileSync('pm2', ['jlist'], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }));
  const app = processes.find(process => process.name === 'ai-platform');
  if (!app || app.pm2_env.status !== 'online') throw new Error('Application unavailable');
  const cwd = app.pm2_env.pm_cwd;
  require(path.join(cwd, 'node_modules/@next/env')).loadEnvConfig(cwd);
  if (!process.env.CRON_SECRET) throw new Error('Existing CRON_SECRET required');
  const response = await fetch('http://127.0.0.1:3000/api/cron/course-generation', {
    method: 'POST', headers: { 'x-cron-secret': process.env.CRON_SECRET }, signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Course watchdog HTTP ${response.status}`);
  const result = await response.json();
  if (result.recovered) console.log(`Recovered ${result.recovered} expired course jobs`);
}
main().catch(() => { console.error('Course generation watchdog failed'); process.exitCode = 1; });
