// Local isolated HTTP contract smoke. Never run against production.
const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd());
process.env.DATABASE_URL = 'file:C:/Claude Projects/AI Chat/ai-platform-voice/prisma/vitest-ui-accounting.db';
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const db = new PrismaClient();
const base = 'http://127.0.0.1:3073';
let user;
const checks = [];
const check = (name, pass, status) => checks.push({ name, pass, ...(status ? { status } : {}) });
(async () => {
  user = await db.user.create({ data: { email: `ui-accounting-${Date.now()}@example.test`, passwordHash: 'local-only', plan: 'BUSINESS', crmPlan: 'SOLO', onboardingDone: true, role: 'USER' } });
  const headers = { cookie: 'token=' + jwt.sign({ userId: user.id, role: user.role, plan: user.plan }, process.env.JWT_SECRET, { expiresIn: 300 }), origin: base, 'content-type': 'application/json' };
  const get = async path => { const r = await fetch(base + path, { headers, signal: AbortSignal.timeout(60000) }); const d = await r.json(); return { r, d }; };
  const shell = await get('/api/app/shell?path=/accounting');
  check('accounting shell contract', shell.r.ok && shell.d.accountingAccess?.allowed && shell.d.accounting && !shell.d.redirect, shell.r.status);
  const sources = [['dashboard', 'cashBalance'], ['accounts', 'accounts'], ['journal-entries', 'entries'], ['expenses', 'expenses'], ['vendors', 'vendors'], ['bank-accounts', 'bankAccounts'], ['bank-transactions', 'transactions'], ['employees', 'employees'], ['payroll-runs', 'runs'], ['budgets', 'rows'], ['tax-rates', 'taxRates'], ['reports/vat', 'netPayable'], ['fiscal-periods', 'periods'], ['owner-statements', 'statements'], ['scheduled-reports', 'reports']];
  for (const [route, key] of sources) { const { r, d } = await get('/api/accounting/' + route); check(route, r.ok && Object.hasOwn(d, key), r.status); }
  const made = await fetch(base + '/api/accounting/journal-entries', { method: 'POST', headers, body: JSON.stringify({ memo: 'Local UI smoke', lines: [{ accountCode: '1000', debit: 25, credit: 0 }, { accountCode: '4000', debit: 0, credit: 25 }] }) });
  const result = await made.json(); check('balanced journal persisted', made.status === 201 && !!result.entry?.id, made.status);
  if (result.entry?.id) { const r = await fetch(base + '/api/accounting/journal-entries/' + result.entry.id, { method: 'POST', headers, body: JSON.stringify({ action: 'reverse' }) }); check('explicit reversal', r.ok, r.status); }
  console.log(JSON.stringify(checks));
  if (checks.some(c => !c.pass)) process.exitCode = 1;
})().catch(() => { console.log({ smoke: 'FAILED' }); process.exitCode = 1; }).finally(async () => {
  if (user) {
    const entries = await db.accountingJournalEntry.findMany({ where: { workspaceUserId: user.id }, select: { id: true } });
    await db.accountingJournalEntryLine.deleteMany({ where: { entryId: { in: entries.map(e => e.id) } } });
    await db.accountingJournalEntry.deleteMany({ where: { workspaceUserId: user.id } });
    await db.accountingAccount.deleteMany({ where: { workspaceUserId: user.id } });
    await db.auditLog.deleteMany({ where: { actorId: user.id } });
    await db.user.delete({ where: { id: user.id } });
  }
  await db.$disconnect();
});
