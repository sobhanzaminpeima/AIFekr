/* Local-only, additive setup. Never enables spending or chooses commercial prices. */
const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');const Database=require('better-sqlite3');
require('@next/env').loadEnvConfig(process.cwd());
async function main(){
 const root=process.cwd(),url=process.env.DATABASE_URL||'';if(!url.startsWith('file:'))throw Error('Local setup supports SQLite only');
 const raw=url.slice(5).split('?')[0],file=path.isAbsolute(raw)?path.resolve(raw):path.resolve(root,'prisma',raw);
 if(!file.startsWith(path.resolve(root)+path.sep))throw Error('Database is outside the explicitly selected local workspace');if(!fs.existsSync(file))throw Error('Configured local database does not exist');
 const db=new Database(file),tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r=>r.name),pending=[];
 for(const [name,table] of [['20261016090000_video_factory','VideoFactoryProject'],['20261016120000_video_factory_multimedia','VideoFactoryProvider']])if(!tables.includes(table))pending.push(name);
 const tools=path.join(process.env.LOCALAPPDATA||path.join(root,'tmp'),'AIFekr','VideoFactory');
 const report={localDatabase:true,pendingMigrations:pending,cronConfigured:!!process.env.CRON_SECRET,openaiKeyPresent:!!process.env.OPENAI_API_KEY,elevenlabsKeyPresent:!!process.env.ELEVENLABS_API_KEY,apply:false};
 if(!process.argv.includes('--apply')){db.close();console.log(JSON.stringify(report));return;}
 fs.mkdirSync(path.join(tools,'backups'),{recursive:true});const backup=path.join(tools,'backups',`before-video-factory-${Date.now()}.db`);await db.backup(backup);
 if(!tables.includes('AuditLog'))db.exec('CREATE TABLE "AuditLog" ("id" TEXT NOT NULL PRIMARY KEY,"actorId" TEXT NOT NULL,"action" TEXT NOT NULL,"targetId" TEXT,"metadata" TEXT,"createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP); CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId"); CREATE INDEX "AuditLog_targetId_idx" ON "AuditLog"("targetId"); CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");');
 for(const name of pending){const sql=fs.readFileSync(path.join(root,'prisma','migrations',name,'migration.sql'),'utf8');db.exec('PRAGMA foreign_keys=OFF');try{db.transaction(()=>{db.exec(sql);if(tables.includes('_prisma_migrations'))db.prepare('INSERT INTO _prisma_migrations (id,checksum,finished_at,migration_name,logs,rolled_back_at,started_at,applied_steps_count) VALUES (?,?,CURRENT_TIMESTAMP,?,NULL,NULL,CURRENT_TIMESTAMP,1)').run(crypto.randomUUID(),crypto.createHash('sha256').update(sql).digest('hex'),name);})();}finally{db.exec('PRAGMA foreign_keys=ON');}}
 const integrity=db.pragma('quick_check');if(integrity[0].quick_check!=='ok')throw Error('Local database integrity check failed');db.close();
 const bin=path.join(tools,'bin');fs.mkdirSync(bin,{recursive:true});const binaries={VIDEO_FACTORY_FFMPEG:path.join(root,'tmp','video-factory','tools','node_modules','ffmpeg-static','ffmpeg.exe'),VIDEO_FACTORY_FFPROBE:path.join(root,'tmp','video-factory','tools','node_modules','ffprobe-static','bin','win32','x64','ffprobe.exe')};
 const envPath=path.join(root,'.env.local');let env=fs.readFileSync(envPath,'utf8');
 function setMissing(key,value){if(process.env[key])return;const line=`${key}=${JSON.stringify(value.replace(/\\/g,'/'))}`;const regex=new RegExp('^'+key+'=.*$','m');env=regex.test(env)?env.replace(regex,line):env.trimEnd()+'\n'+line+'\n';}
 for(const [key,source] of Object.entries(binaries))if(!process.env[key]&&fs.existsSync(source)){const target=path.join(bin,key==='VIDEO_FACTORY_FFMPEG'?'ffmpeg.exe':'ffprobe.exe');fs.copyFileSync(source,target);setMissing(key,target);}
 const clamRoot=path.join(tools,'clamav');if(fs.existsSync(clamRoot)){const candidate=fs.readdirSync(clamRoot,{recursive:true}).map(p=>path.join(clamRoot,p)).find(p=>p.endsWith(path.sep+'clamscan.exe'));if(candidate)setMissing('VIDEO_FACTORY_CLAMSCAN',candidate);}
 if(!process.env.VIDEO_FACTORY_CLAMSCAN && fs.existsSync('C:/Program Files/Windows Defender/MpCmdRun.exe'))setMissing('VIDEO_FACTORY_DEFENDER','C:/Program Files/Windows Defender/MpCmdRun.exe');
 setMissing('CRON_SECRET',crypto.randomBytes(32).toString('hex'));setMissing('VIDEO_FACTORY_STORAGE_DIR',path.join(tools,'storage'));fs.writeFileSync(envPath,env,{mode:0o600});
 const receipt={...report,apply:true,backupCreated:true,migrationsApplied:pending,policyChanged:false,paidRequests:0,updatedAt:new Date().toISOString()};fs.writeFileSync(path.join(tools,'local-setup.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
