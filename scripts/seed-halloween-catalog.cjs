// Explicit, bounded catalog insertion. Existing admin edits are never overwritten.
const fs=require('node:fs');
const path=require('node:path');
const {PrismaClient}=require(process.env.PRISMA_RUNTIME_PATH||'@prisma/client');
async function main(){
 if(!process.argv.includes('--apply'))throw Error('Use --apply after taking a verified database backup');
 const rows=JSON.parse(fs.readFileSync(path.join(__dirname,'../prisma/catalogs/halloween-2026.json'),'utf8'));
 if(rows.length!==6||rows.some(r=>!r.id.startsWith('aifekr-halloween-2026-')||r.category!=='halloween'||r.toolType!=='image'))throw Error('Unexpected catalog');
 const db=new PrismaClient();
 try{const created=await db.$transaction(async tx=>{let n=0;for(const row of rows){if(await tx.prompt.findUnique({where:{id:row.id},select:{id:true}}))continue;await tx.prompt.create({data:row});n++;}return n;});console.log(JSON.stringify({created,skipped:6-created}));}finally{await db.$disconnect();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
