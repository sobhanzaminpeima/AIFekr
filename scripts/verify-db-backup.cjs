// Proves a SQLite backup is restorable before a release relies on it: the file
// opens, passes SQLite's own integrity check, has no foreign-key errors, and
// carries the same key row counts and credit totals as the source database.
// A backup that was never read back is only a hope, not a rollback plan.
//
//   node scripts/verify-db-backup.cjs <backup.db> [source.db]
const fs = require('node:fs');
const SQLite = require('better-sqlite3');

const TABLES = ['User', 'Payment', 'Team', 'WalletTransaction', '_prisma_migrations'];

function snapshot(file) {
  const db = new SQLite(file, { readonly: true, fileMustExist: true });
  try {
    const integrity = db.pragma('integrity_check', { simple: true });
    const foreignKeyErrors = db.pragma('foreign_key_check').length;
    const counts = {};
    for (const table of TABLES) {
      const exists = db.prepare("select 1 from sqlite_master where type='table' and name=?").get(table);
      counts[table] = exists ? db.prepare(`select count(*) as n from "${table}"`).get().n : null;
    }
    const credits = db.prepare('select coalesce(sum(credits),0) as n from "User"').get().n;
    return { integrity, foreignKeyErrors, counts, credits };
  } finally {
    db.close();
  }
}

function main() {
  const [backup, source] = process.argv.slice(2);
  if (!backup || !fs.existsSync(backup)) throw new Error('Usage: verify-db-backup.cjs <backup.db> [source.db]');
  const copy = snapshot(backup);
  if (copy.integrity !== 'ok') throw new Error(`Backup failed integrity_check: ${copy.integrity}`);
  if (copy.foreignKeyErrors) throw new Error(`Backup has ${copy.foreignKeyErrors} foreign-key errors`);
  if (source) {
    const live = snapshot(source);
    const same = JSON.stringify(live.counts) === JSON.stringify(copy.counts) && live.credits === copy.credits;
    if (!same) throw new Error(`Backup does not match source: backup=${JSON.stringify(copy)} source=${JSON.stringify(live)}`);
  }
  console.log(`Backup verified: ${JSON.stringify({ counts: copy.counts, credits: copy.credits })}`);
}

try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
