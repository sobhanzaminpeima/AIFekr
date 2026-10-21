-- Lets admin-added custom providers target the chat, image, or video model
-- picker instead of always being treated as a chat endpoint.
ALTER TABLE "CustomAiProvider" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'chat';
