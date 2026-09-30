import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const migration = readFileSync(resolve(process.cwd(), "prisma/migrations/20260928_add_instagram_campaign_name/migration.sql"), "utf8");
let db: Database.Database;

afterEach(() => db?.close());

describe("Instagram campaign name migration", () => {
  it("adds a non-null display name without breaking existing automations", () => {
    db = new Database(":memory:");
    db.exec(`
      CREATE TABLE "InstagramCommentCampaign" ("id" TEXT PRIMARY KEY, "keyword" TEXT NOT NULL);
      INSERT INTO "InstagramCommentCampaign" VALUES ('existing-campaign', 'aifekr');
    `);
    db.exec(migration);

    expect(db.prepare(`SELECT "name", "keyword" FROM "InstagramCommentCampaign" WHERE "id" = 'existing-campaign'`).get())
      .toEqual({ name: "", keyword: "aifekr" });
  });
});
