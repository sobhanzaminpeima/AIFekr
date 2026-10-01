import { vi } from "vitest";
const emailMocks = vi.hoisted(() => ({ sendEmail: vi.fn(async () => true) }));
vi.hoisted(() => { process.env.JWT_SECRET ||= "student-group-test-secret"; });
vi.mock("@/lib/email/resend", () => ({ sendEmail: emailMocks.sendEmail }));

import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { signToken } from "@/lib/auth/jwt";
import { prisma } from "@/lib/db/prisma";
import { POST as createGroup } from "./route";
import { POST as joinGroup } from "./join/route";
import { GET as getMessages, POST as sendMessage } from "./[id]/messages/route";
import { POST as inviteByEmail } from "./[id]/invite/route";

const ownerId = `study-group-owner-${crypto.randomUUID()}`;
const memberId = `study-group-member-${crypto.randomUUID()}`;
const outsiderId = `study-group-outsider-${crypto.randomUUID()}`;
const inviteeId = `study-group-invitee-${crypto.randomUUID()}`;
const token = (userId: string) => signToken({ userId, role: "USER", plan: "FREE" });
const req = (userId: string, path: string, method = "GET", body?: unknown) => new NextRequest(`https://aifekr.test${path}`, { method, headers: { Cookie: `token=${token(userId)}`, "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
let groupId = "";
let inviteCode = "";

beforeAll(async () => {
  const sql = readFileSync(path.resolve(process.cwd(), "prisma/migrations/20261001_student_study_groups/migration.sql"), "utf8");
  for (const statement of sql.split(";").map((part) => part.trim()).filter(Boolean)) await prisma.$executeRawUnsafe(statement);
});
beforeEach(async () => {
  await prisma.user.createMany({ data: [ownerId, memberId, outsiderId, inviteeId].map((id) => ({ id, email: `${id}@example.test` })) });
  await prisma.siteSetting.upsert({ where: { key: "student_workspace_enabled" }, create: { key: "student_workspace_enabled", value: "true" }, update: { value: "true" } });
});
afterEach(async () => {
  await prisma.studentStudyGroup.deleteMany({ where: { ownerId } });
  await prisma.user.deleteMany({ where: { id: { in: [ownerId, memberId, outsiderId, inviteeId] } } });
});
afterAll(async () => prisma.$disconnect());

describe("student study groups", () => {
  it("allows members to join and exchange messages, while isolating outsiders", async () => {
    const created = await createGroup(req(ownerId, "/api/student/groups", "POST", { name: "Study team" }));
    expect(created.status).toBe(201);
    const { group } = await created.json();
    groupId = group.id; inviteCode = group.inviteCode;
    expect(inviteCode).toHaveLength(32);

    expect((await getMessages(req(outsiderId, `/api/student/groups/${groupId}/messages`), { params: { id: groupId } })).status).toBe(404);
    expect((await joinGroup(req(memberId, "/api/student/groups/join", "POST", { inviteCode }))).status).toBe(200);
    const posted = await sendMessage(req(memberId, `/api/student/groups/${groupId}/messages`, "POST", { content: "Review chapter 2" }), { params: { id: groupId } });
    expect(posted.status).toBe(201);
    const messages = await getMessages(req(memberId, `/api/student/groups/${groupId}/messages`), { params: { id: groupId } });
    expect((await messages.json()).messages[0].content).toBe("Review chapter 2");
    expect((await getMessages(req(outsiderId, `/api/student/groups/${groupId}/messages`), { params: { id: groupId } })).status).toBe(404);
  });

  it("adds a registered student by email and sends in-app and email notifications", async () => {
    const created = await createGroup(req(ownerId, "/api/student/groups", "POST", { name: "Research group" }));
    const group = (await created.json()).group;
    const response = await inviteByEmail(req(ownerId, `/api/student/groups/${group.id}/invite`, "POST", { email: `${inviteeId}@example.test` }), { params: { id: group.id } });
    expect(response.status).toBe(200);
    expect((await response.json()).added).toBe(true);
    expect(await prisma.studentStudyGroupMember.findUnique({ where: { groupId_userId: { groupId: group.id, userId: inviteeId } } })).not.toBeNull();
    expect(await prisma.notification.findFirst({ where: { userId: inviteeId, type: "student_group_invite" } })).not.toBeNull();
    expect(emailMocks.sendEmail).toHaveBeenCalledWith(`${inviteeId}@example.test`, expect.any(String), expect.stringContaining("Research group"));
  });
});
