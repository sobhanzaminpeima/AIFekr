const Database = require('better-sqlite3');
const fs = require('node:fs');
const path = require('node:path');
const url = process.env.DATABASE_URL || '';
if (!url.startsWith('file:')) throw new Error('SQLite DATABASE_URL required');
const location = url.slice(5);
const databasePath = path.isAbsolute(location) ? location : path.resolve('prisma', location);
const db = new Database(databasePath, {fileMustExist:true});
const fields = db.prepare('PRAGMA table_info("User")').all();
if(fields.some(f=>f.name==='accountType')) {
  for(const [table,column] of [['VoiceAgent','provisioningAt'],['VoiceCallLog','creditTeamId'],['VoiceAppointment','toolCallId']]) {
    if(!db.prepare(`PRAGMA table_info("${table}")`).all().some(f=>f.name===column)) throw new Error('Partial migration; manual repair required');
  }
  console.log('Voice service schema is already current');
} else {
  const duplicate=db.prepare('SELECT COUNT(*) AS n FROM (SELECT vapiPhoneNumberId FROM VoiceAgent WHERE vapiPhoneNumberId IS NOT NULL GROUP BY vapiPhoneNumberId HAVING COUNT(*)>1)').get();
  if(duplicate.n) throw new Error('Duplicate phone allocations must be resolved before migration');
  if(!process.argv.includes('--apply')) console.log('Dry run: additive schema and audience backfill ready. Use --apply after a database backup.');
  else {
    const sql=fs.readFileSync(path.join(__dirname,'../prisma/migrations/20261004_voice_service_and_account_audience/migration.sql'),'utf8');
    db.transaction(()=>db.exec(sql))();
    console.log('Voice service schema upgraded; student/business audiences backfilled');
  }
}
db.close();
