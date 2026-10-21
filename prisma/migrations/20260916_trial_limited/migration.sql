-- The "referral trial" package: a Pro trial with Video Generator and
-- Website Designer blocked behind an upgrade prompt. Defaults to false so
-- every existing trial/user is unaffected.

ALTER TABLE "User" ADD COLUMN "trialLimited" BOOLEAN NOT NULL DEFAULT false;
