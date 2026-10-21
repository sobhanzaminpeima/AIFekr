import { beforeAll, afterAll, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
vi.hoisted(() => {
  process.env.DATABASE_URL = `file:${process.cwd().replace(/\\/g, "/")}/tmp/play-test-${process.pid}.db`;
  process.env.JWT_SECRET = "isolated-play-test";
});
import { prisma } from "@/lib/db/prisma";
import {
  startSession,
  finishSession,
  playOverview,
  levelForXp,
} from "./service";
import { brainAction } from "./brain";
import { competitionCommand } from "./competitions";
import { GET as adminGet } from "@/app/api/admin/play/route";
import { NextRequest } from "next/server";
import {POST as chooseReward} from "@/app/api/play/rewards/route";
import {signToken} from "@/lib/auth/jwt";
import type { PlayTournament } from "@prisma/client";
let userId: string, otherId: string;
it("lets an expired chat-only winner choose their reward once, without purchasing",async()=>{
 const owner=await prisma.user.create({data:{email:"free-winner@test.invalid",chatOnly:true,trialEndsAt:new Date(0)}});
 await prisma.playProfile.create({data:{userId:owner.id}});
 const tournament=await prisma.playTournament.create({data:{title:"Free choice test",description:"Test only",gameSlug:"tower",seed:1,startsAt:new Date(),endsAt:new Date(Date.now()+60000),terms:"No purchase required. Test only."}});
 const grant=await prisma.playRewardGrant.create({data:{tournamentId:tournament.id,userId:owner.id,title:"MONTHLY_PACKAGE_CHOICE",approvedBy:userId}});
 const request=(uid:string,choice="FITNESS")=>new NextRequest("http://localhost/api/play/rewards",{method:"POST",headers:{host:"localhost",origin:"http://localhost",cookie:`token=${signToken({userId:uid,role:"USER",plan:"FREE"})}`,"Content-Type":"application/json"},body:JSON.stringify({id:grant.id,choice})});
 expect((await chooseReward(request(otherId))).status).toBe(409);
 expect((await chooseReward(request(owner.id))).status).toBe(200);
 expect((await chooseReward(request(owner.id,"BUSINESS"))).status).toBe(409);
 expect((await prisma.playRewardGrant.findUniqueOrThrow({where:{id:grant.id}})).packageChoice).toBe("FITNESS");
 expect(await prisma.payment.count({where:{userId:owner.id}})).toBe(0);
});
it("enforces free competition attempts, shared seeds, closing, approval and one reward fulfillment", async () => {
  await prisma.playSession.updateMany({
    where: { status: "OPEN" },
    data: { status: "ABANDONED" },
  });
  const t = (await competitionCommand(userId, {
    action: "create",
    configuration: {
      title: "Test tournament",
      description: "Isolated database only",
      gameSlug: "2048",
      startsAt: new Date(Date.now() - 60000).toISOString(),
      endsAt: new Date(Date.now() + 60000).toISOString(),
      maxAttempts: 1,
      maxParticipants: 2,
      rewardTitle: "Test-only badge",
      terms:
        "Free entry. Highest verified score wins; earliest result breaks ties.",
    },
  })) as PlayTournament;
  await expect(startSession(userId, "2048", "en", t.id)).rejects.toThrow(
    "COMPETITION_UNAVAILABLE",
  );
  await competitionCommand(userId, { action: "publish", id: t.id });
  const a = await startSession(userId, "2048", "en", t.id),
    b = await startSession(otherId, "2048", "en", t.id);
  expect(a.seed).toBe(b.seed);
  await expect(startSession(userId, "2048", "en", t.id)).rejects.toThrow(
    "ATTEMPT_LIMIT",
  );
  await finishSession(userId, a.id, [{ frame: 1, input: "left" }], 1);
  await finishSession(otherId, b.id, [{ frame: 1, input: "left" }], 1);
  await expect(
    competitionCommand(userId, { action: "close", id: t.id }),
  ).rejects.toThrow("COMPETITION_NOT_ENDED");
  await prisma.playSession.updateMany({
    where: { tournamentId: t.id },
    data: { completedAt: new Date(Date.now() - 5000) },
  });
  await prisma.playTournament.update({
    where: { id: t.id },
    data: { endsAt: new Date(Date.now() - 1000) },
  });
  await competitionCommand(userId, { action: "close", id: t.id });
  await competitionCommand(userId, { action: "approve", id: t.id });
  expect(
    await prisma.playRewardGrant.count({ where: { tournamentId: t.id } }),
  ).toBe(1);
  await expect(
    competitionCommand(userId, { action: "approve", id: t.id }),
  ).rejects.toThrow("WINNERS_NOT_READY");
  const grant = await prisma.playRewardGrant.findFirstOrThrow({
    where: { tournamentId: t.id },
  });
  await competitionCommand(userId, {
    action: "fulfill",
    id: grant.id,
    note: "Test-only delivery recorded",
  });
  await expect(
    competitionCommand(userId, {
      action: "fulfill",
      id: grant.id,
      note: "Duplicate delivery",
    }),
  ).rejects.toThrow("REWARD_NOT_APPROVED");
  expect(
    (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).credits,
  ).toBe(321);
});
beforeAll(async () => {
  mkdirSync("tmp", { recursive: true });
  const sql = execFileSync(
      process.execPath,
      [
        "node_modules/prisma/build/index.js",
        "migrate",
        "diff",
        "--from-empty",
        "--to-schema-datamodel",
        "prisma/schema.prisma",
        "--script",
      ],
      { stdio: "pipe" },
    ).toString(),
    db = new Database(process.env.DATABASE_URL!.slice(5));
  db.exec(sql);
  for (const table of [
    "PlayRewardGrant",
    "PlayTournamentEntry",
    "PlayTournament",
    "PlayXpEntry",
    "PlayAchievementGrant",
    "PlaySession",
    "PlayQuestion",
    "PlayGame",
    "PlayProfile",
  ])
    db.exec(`DROP TABLE "${table}"`);
  db.exec(
    readFileSync(
      "prisma/migrations/20261020150000_play_foundation/migration.sql",
      "utf8",
    ),
  );
  db.exec('ALTER TABLE "PlayRewardGrant" ADD COLUMN "packageChoice" TEXT NOT NULL DEFAULT \'\'');
  db.close();
  userId = (
    await prisma.user.create({
      data: { email: "play-only@test.invalid", credits: 321 },
    })
  ).id;
  otherId = (
    await prisma.user.create({ data: { email: "play-other@test.invalid" } })
  ).id;
  await prisma.siteSetting.create({
    data: { key: "aifekrPlay", value: '{"status":"ENABLED"}' },
  });
  for (const slug of ["2048", "tower", "brain"])
    await prisma.playGame.create({ data: { slug } });
}, 90000);
afterAll(async () => {
  await prisma.$disconnect();
  const file = path.resolve(process.env.DATABASE_URL!.slice(5));
  if (!file.startsWith(path.resolve("tmp") + path.sep))
    throw Error("UNSAFE_TEST_PATH");
  rmSync(file, { force: true });
  rmSync(file + "-journal", { force: true });
});
it("creates user-owned seeded sessions and persists exactly one XP entry on replay", async () => {
  const s = await startSession(userId, "2048", "en"),
    events = [
      { frame: 1, input: "left" as const },
      { frame: 2, input: "down" as const },
    ],
    a = await finishSession(userId, s.id, events, 2),
    b = await finishSession(userId, s.id, events, 2);
  expect(a.score).toBe(b.score);
  expect(await prisma.playXpEntry.count({ where: { sessionId: s.id } })).toBe(
    1,
  );
  expect(
    (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).credits,
  ).toBe(321);
  await expect(finishSession(otherId, s.id, events, 2)).rejects.toThrow(
    "SESSION_NOT_FOUND",
  );
  await expect(finishSession(userId, s.id, [], 2)).rejects.toThrow(
    "RESULT_CONFLICT",
  );
});
it("rejects impossible timing and paused or suspended access", async () => {
  const s = await startSession(userId, "tower", "en");
  await expect(finishSession(userId, s.id, [], 10000)).rejects.toThrow(
    "REPLAY_TOO_FAST",
  );
  await prisma.playProfile.update({
    where: { userId },
    data: { suspended: true },
  });
  await expect(startSession(userId, "tower", "en")).rejects.toThrow(
    "PLAY_SUSPENDED",
  );
  await prisma.playProfile.update({
    where: { userId },
    data: { suspended: false },
  });
});
it("never exposes private names or grants admin access to guests", async () => {
  const overview = await playOverview(userId);
  expect(overview.rankings.every((r) => r.name.startsWith("Player"))).toBe(
    true,
  );
  expect(
    (await adminGet(new NextRequest("http://localhost/api/admin/play"))).status,
  ).toBe(401);
  expect(levelForXp(0)).toBe(1);
  expect(levelForXp(900)).toBe(4);
});
it("requires reviewed questions and validates answers once on the server", async () => {
  await expect(startSession(otherId, "brain", "en")).rejects.toThrow(
    "QUESTION_BANK_NOT_READY",
  );
  for (let i = 0; i < 5; i++)
    await prisma.playQuestion.create({
      data: {
        language: "en",
        prompt: `Test-only arithmetic ${i}`,
        options: '["2","3","4","5"]',
        answer: 2,
        explanation: "Two plus two equals four",
        status: "PUBLISHED",
        fingerprint: `test-${i}`,
      },
    });
  const session = await startSession(otherId, "brain", "en"),
    q = await brainAction(otherId, session.id);
  expect(q.question).not.toHaveProperty("answer");
  await brainAction(otherId, session.id, 0, 2);
  await expect(brainAction(otherId, session.id, 0, 2)).rejects.toThrow(
    "ANSWER_CONFLICT",
  );
  for (let i = 1; i < 5; i++) await brainAction(otherId, session.id, i, 2);
  expect(
    (await prisma.playSession.findUniqueOrThrow({ where: { id: session.id } }))
      .status,
  ).toBe("ACCEPTED");
  expect(
    await prisma.playXpEntry.count({ where: { sessionId: session.id } }),
  ).toBe(1);
});
