-- Add WhatsApp/Telegram contact identifiers to CrmContact so contacts can be
-- messaged directly from the CRM UI via wa.me / t.me deep links.
ALTER TABLE "CrmContact" ADD COLUMN "whatsapp" TEXT;
ALTER TABLE "CrmContact" ADD COLUMN "telegram" TEXT;
