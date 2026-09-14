-- German fields for ready-made prompts. Every consumer previously fell back to
-- English for any non-Persian language, and the admin editor had no German
-- inputs. Nullable: existing rows keep working, falling back to English.

ALTER TABLE "Prompt" ADD COLUMN "titleDe" TEXT;
ALTER TABLE "Prompt" ADD COLUMN "contentDe" TEXT;
ALTER TABLE "Prompt" ADD COLUMN "guideDe" TEXT;
