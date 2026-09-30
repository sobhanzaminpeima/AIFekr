import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const migration = readFileSync(resolve(process.cwd(), "prisma/migrations/20260928_instagram_direct_delivery_options/migration.sql"), "utf8");
let db: Database.Database;

afterEach(() => db?.close());

describe("Auto Direct delivery migration", () => {
  it("adds safe defaults and optional gate reply storage without changing existing rows", () => {
    db = new Database(":memory:");
    db.exec(`
      CREATE TABLE "InstagramDirectRule" ("id" TEXT PRIMARY KEY, "response" TEXT NOT NULL);
      CREATE TABLE "InstagramDirectMessageLog" ("id" TEXT PRIMARY KEY, "text" TEXT);
      INSERT INTO "InstagramDirectRule" VALUES ('existing-rule', 'Welcome');
      INSERT INTO "InstagramDirectMessageLog" VALUES ('existing-log', 'Hello');
    `);
    db.exec(migration);

    expect(db.prepare(`SELECT "followGateEnabled", "typingIndicatorEnabled", "delayMinSeconds", "delayMaxSeconds" FROM "InstagramDirectRule" WHERE id='existing-rule'`).get())
      .toEqual({ followGateEnabled: 0, typingIndicatorEnabled: 0, delayMinSeconds: 0, delayMaxSeconds: 0 });
    expect(db.prepare(`SELECT "text", "replyText" FROM "InstagramDirectMessageLog" WHERE id='existing-log'`).get())
      .toEqual({ text: "Hello", replyText: null });
  });
});
