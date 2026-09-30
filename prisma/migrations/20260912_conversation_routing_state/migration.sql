-- Bounded per-conversation orchestrator routing state (last domain + a short
-- LRU of entity ids), so a follow-up like "move that one to won" can resolve
-- what "that one" referred to. Nullable: every existing conversation simply
-- starts with no state.
ALTER TABLE "Conversation" ADD COLUMN "routingState" TEXT;
