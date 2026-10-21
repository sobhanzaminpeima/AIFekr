require('@next/env').loadEnvConfig(process.cwd());
const fs=require('node:fs'),path=require('node:path'),{randomUUID,createHash}=require('node:crypto'),SQLite=require('better-sqlite3');
const name=process.argv[2];if(!/^\d{14}_[a-z_]+$/.test(name||''))throw Error('Invalid migration name');
const raw=process.env.DATABASE_URL?.slice(5);if(!process.env.DATABASE_URL?.startsWith('file:')||!raw)throw Error('SQLite database required');
const db=new SQLite(path.isAbsolute(raw)?raw:path.resolve('prisma',raw),{fileMustExist:true});
try{db.pragma('busy_timeout=10000');const sql=fs.readFileSync(path.join('prisma/migrations',name,'migration.sql'),'utf8');if(/\b(DROP|DELETE|TRUNCATE)\b/i.test(sql))throw Error('Not additive');
 const checksum=createHash('sha256').update(sql).digest('hex'),applied=db.prepare('SELECT checksum FROM _prisma_migrations WHERE migration_name=? AND finished_at IS NOT NULL AND rolled_back_at IS NULL').get(name);
 if(applied){if(applied.checksum!==checksum)throw Error('Applied migration checksum differs');}
 else db.transaction(()=>{db.exec(sql);const now=Date.now();db.prepare('INSERT INTO _prisma_migrations(id,checksum,finished_at,migration_name,started_at,applied_steps_count) VALUES(?,?,?,?,?,1)').run(randomUUID(),checksum,now,name,now);})();
 console.log(name+': ready; integrity '+db.pragma('quick_check',{simple:true}));
}finally{db.close();}
