const path = require('node:path');
const fs = require('node:fs');
const SQLite = require('better-sqlite3');
async function main() {
  if(!process.env.DATABASE_URL?.startsWith('file:'))throw Error('Expected SQLite DATABASE_URL');
  const url=process.env.DATABASE_URL.slice(5);
  const source=path.isAbsolute(url)?url:path.resolve(process.cwd(),'prisma',url);
  const destination=process.argv[2];
  if(!destination||!fs.existsSync(source))throw Error('Existing database and backup destination required');
  const db=new SQLite(source,{readonly:true,fileMustExist:true});
  try { await db.backup(destination); } finally { db.close(); }
  console.log('Consistent SQLite deployment backup created.');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
