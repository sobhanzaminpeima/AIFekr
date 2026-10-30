-- Onboarding goals (multi-select). Additive: existing rows get an empty list.
ALTER TABLE "GrowthProfile" ADD COLUMN "goals" TEXT NOT NULL DEFAULT '';
