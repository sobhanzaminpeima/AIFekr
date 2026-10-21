import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const migration = readFileSync(resolve(process.cwd(), "prisma/migrations/20260927_add_instagram_auto_direct_saas/migration.sql"), "utf8");
let db: Database.Database;

afterEach(() => db?.close());

describe("Auto Direct SQLite migration", () => {
  it("creates the SaaS tables and backfills only users with an unambiguous Instagram workspace", () => {
    db = new Database(":memory:");
    db.exec(`
      CREATE TABLE "InstagramConnection" ("id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "businessId" TEXT);
      CREATE TABLE "InstagramCommentCampaign" ("id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL);
      CREATE TABLE "InstagramCommentReplyLog" ("id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "campaignId" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE "InstagramFollowerSnapshot" ("id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "date" DATETIME NOT NULL, "followersCount" INTEGER NOT NULL, "mediaCount" INTEGER NOT NULL);
      CREATE UNIQUE INDEX "InstagramFollowerSnapshot_userId_date_key" ON "InstagramFollowerSnapshot"("userId", "date");
      INSERT INTO "InstagramConnection" VALUES ('c1', 'single', 'business-a');
      INSERT INTO "InstagramConnection" VALUES ('c2', 'multi', 'business-a');
      INSERT INTO "InstagramConnection" VALUES ('c3', 'multi', 'business-b');
      INSERT INTO "InstagramCommentCampaign" VALUES ('campaign-1', 'single');
      INSERT INTO "InstagramCommentReplyLog" ("id", "userId", "campaignId") VALUES ('log-1', 'single', 'campaign-1');
      INSERT INTO "InstagramFollowerSnapshot" VALUES ('snapshot-1', 'single', '2026-09-27T00:00:00.000Z', 10, 1);
      INSERT INTO "InstagramFollowerSnapshot" VALUES ('snapshot-2', 'multi', '2026-09-27T00:00:00.000Z', 20, 2);
    `);

    db.exec(migration);

    expect(db.prepare(`SELECT "businessId" FROM "InstagramCommentCampaign" WHERE id='campaign-1'`).get()).toEqual({ businessId: "business-a" });
    expect(db.prepare(`SELECT "businessId" FROM "InstagramCommentReplyLog" WHERE id='log-1'`).get()).toEqual({ businessId: "business-a" });
    expect(db.prepare(`SELECT "businessId" FROM "InstagramFollowerSnapshot" WHERE id='snapshot-1'`).get()).toEqual({ businessId: "business-a" });
    expect(db.prepare(`SELECT "businessId" FROM "InstagramFollowerSnapshot" WHERE id='snapshot-2'`).get()).toEqual({ businessId: null });
    expect(db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='InstagramDirectRule'`).get()).toEqual({ name: "InstagramDirectRule" });
    expect(db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='InstagramDirectMessageLog'`).get()).toEqual({ name: "InstagramDirectMessageLog" });
  });
});
