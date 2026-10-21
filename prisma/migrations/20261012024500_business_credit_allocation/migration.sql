-- Preserve the existing business convention: quoted months receive the
-- monthly allocation multiplied by the purchased term, granted upfront.
-- Historical payment snapshots and balances are not changed.
UPDATE Package SET creditAllocation='MONTHLY_TOTAL'
WHERE planCode='TEAM_BUSINESS_GROW' AND credits=12000 AND creditAllocation='TERM';
UPDATE Package SET creditAllocation='MONTHLY_TOTAL'
WHERE planCode='TEAM_BUSINESS_SCALE' AND credits=30000 AND creditAllocation='TERM';
