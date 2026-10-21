-- Language for the unattended daily CEO briefing.
--
-- The daily cron has no HTTP request, so it cannot read the `lang` cookie the
-- interactive orchestrator route uses. Without this column every scheduled
-- briefing went out in Persian no matter what language the user works in.
-- Additive with a default matching the previous behaviour, so existing rows
-- keep exactly the language they were already getting.
ALTER TABLE "User" ADD COLUMN "ceoAutoRunLang" TEXT NOT NULL DEFAULT 'fa';
