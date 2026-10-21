-- Give comment-to-DM campaigns an editable, user-facing automation name.
ALTER TABLE "InstagramCommentCampaign" ADD COLUMN "name" TEXT NOT NULL DEFAULT '';
