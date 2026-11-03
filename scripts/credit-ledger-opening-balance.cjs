// One-off, additive backfill for the credit ledger (CreditLedgerEntry): gives every
// wallet with no OPENING_BALANCE row one, equal to its stored balance minus what
// the ledger already holds, so balance == sum(ledger) from then on. Only INSERTs;
// never changes a balance. Safe to re-run (wallets that have a row are skipped).
// Usage on the server, from the release folder: node scripts/credit-ledger-opening-balance.cjs [--dry-run]
require('@next/env').loadEnvConfig(process.cwd());
const path = require('node:path'), { randomUUID } = require('node:crypto'), SQLite = require('better-sqlite3');
const dry = process.argv.includes('--dry-run');
const raw = process.env.DATABASE_URL?.slice(5);
if (!process.env.DATABASE_URL?.startsWith('file:') || !raw) throw Error('SQLite database required');
const db = new SQLite(path.isAbsolute(raw) ? raw : path.resolve('prisma', raw), { fileMustExist: true, readonly: dry });
try {
  db.pragma('busy_timeout=10000');
  const wallets = (kind) => {
    const table = kind === 'team' ? 'Team' : 'User', col = kind === 'team' ? 'teamId' : 'userId';
    const filter = kind === 'team' ? 'l.teamId = w.id' : 'l.userId = w.id AND l.teamId IS NULL';
    return db.prepare(`SELECT w.id, ${kind === 'team' ? 'w.ownerId' : 'w.id'} AS owner, w.credits,
      COALESCE((SELECT SUM(l.delta) FROM CreditLedgerEntry l WHERE ${filter}), 0) AS ledger,
      EXISTS(SELECT 1 FROM CreditLedgerEntry l WHERE ${filter} AND l.type = 'OPENING_BALANCE') AS opened
      FROM ${table} w`).all().map((r) => ({ ...r, kind, col }));
  };
  const insert = db.prepare(`INSERT INTO CreditLedgerEntry (id, userId, teamId, delta, balanceAfter, type, operationId, reason, createdAt)
    VALUES (?, ?, ?, ?, ?, 'OPENING_BALANCE', ?, 'Balance before the credit ledger existed', ?)`);
  const run = () => {
    let rows = 0, credits = 0;
    for (const w of [...wallets('user'), ...wallets('team')]) {
      const delta = w.credits - w.ledger;
      if (w.opened || delta === 0) continue;
      rows++; credits += delta;
      if (!dry) insert.run(randomUUID(), w.owner, w.kind === 'team' ? w.id : null, delta, w.credits, `opening:${w.kind}:${w.id}`, Date.now());
    }
    return { rows, credits };
  };
  // IMMEDIATE: takes the write lock first, so no balance can move between reading it and recording it.
  const result = dry ? run() : db.transaction(run).immediate();
  console.log(`${dry ? 'dry-run: would insert' : 'inserted'} ${result.rows} opening rows totalling ${result.credits} credits`);
} finally { db.close(); }
