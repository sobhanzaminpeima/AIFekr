// Apply only catalog inserts from the existing migrations. Safe to rerun.
import { PrismaClient } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();
async function main() {
  const files = ['20261011140000_fit_dynamic_billing', '20261012180000_advanced_fit_programs'];
  await prisma.$transaction(async tx => {
    for (const name of files) {
      const sql = fs.readFileSync(path.join(__dirname, '../prisma/migrations', name, 'migration.sql'), 'utf8');
      for (const line of sql.split(/\r?\n/)) {
        if (/^INSERT (?:OR IGNORE )?INTO Fitness(?:Trainer|Exercise|Program)\b/.test(line)) {
          await tx.$executeRawUnsafe(line.replace(/^INSERT INTO/, 'INSERT OR IGNORE INTO'));
        }
      }
    }
  }, { timeout: 30000 });
  console.log(JSON.stringify({trainers:await prisma.fitnessTrainer.count(),programs:await prisma.fitnessProgram.count(),exercises:await prisma.fitnessExercise.count()}));
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>prisma.$disconnect());

