-- Property price currency (IRT/IRR/USD/GBP/EUR). Purely additive, defaults
-- to IRT since every existing row was priced in Toman before this field.
ALTER TABLE "VoiceProperty" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'IRT';
