-- Property Management CRM module (Section 1, item 1): add a photo-gallery
-- field to the unified Property model. Purely additive, nullable, no
-- existing data touched.

ALTER TABLE "VoiceProperty" ADD COLUMN "images" TEXT;
