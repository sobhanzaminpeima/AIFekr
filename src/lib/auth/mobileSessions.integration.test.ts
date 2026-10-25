import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
const fixture = vi.hoisted(() => {
  process.env.JWT_SECRET ||= "mobile-session-test-key";
  process.env.MOBILE_API_ENABLED = "true";
  return { url: "", directory: "" };
});
vi.mock("@/lib/db/prisma", async () => {
  const { mkdtempSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { PrismaClient } = await import("@prisma/client");
  fixture.directory = mkdtempSync(join(tmpdir(), "aifekr-mobile-session-test-"));
  writeFileSync(join(fixture.directory, "test.db"), "");
  fixture.url = `file:${join(fixture.directory, "test.db").replaceAll("\\", "/")}`;
  return { prisma: new PrismaClient({ datasources: { db: { url: fixture.url } } }) };
});
import { prisma } from "@/lib/db/prisma";
import { createMobileSession, mobileIdentity, revokeByRefresh, rotateMobileSession } from "./mobileSessions";
import { signToken, verifyMobileAccess, verifyToken } from "./jwt";
import { requireAuth,unauthorizedResponse } from "./middleware";
import { NextRequest } from "next/server";
import {PUT as registerPush} from '@/app/api/mobile/v1/session/push/route';
import {enqueueMobilePush,dispatchMobilePush} from '@/lib/mobile/push';
import {notify} from '@/lib/notifications/create';

const userId = "mobile-session-test-user";
beforeAll(() => {
  const result = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", "db", "push", "--skip-generate"], { env: { ...process.env, DATABASE_URL: fixture.url }, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`Isolated schema setup failed: ${result.stdout}\n${result.stderr}`);
}, 60000);
beforeEach(async () => {
  await prisma.mobileSession.deleteMany(); await prisma.user.deleteMany();
  await prisma.user.create({ data: { id: userId, email: "native-test@example.test", name: "Native session test" } });
});
afterAll(async () => { await prisma.$disconnect(); });
describe("native sessions on an isolated SQLite database", () => {
  it('binds push to the live native session, transfers a device token and disables it explicitly',async()=>{
    const first=(await createMobileSession(userId,'First'))!,second=(await createMobileSession(userId,'Second'))!,token='ExpoPushToken[synthetic_fixture_token]';
    const put=(access:string,value:string|null)=>registerPush(new NextRequest('https://example.test/api/mobile/v1/session/push',{method:'PUT',headers:{Authorization:`Bearer ${access}`,'Content-Type':'application/json'},body:JSON.stringify({token:value})}));
    expect((await put(first.accessToken,token)).status).toBe(200);expect((await put(second.accessToken,token)).status).toBe(200);
    expect((await prisma.mobileSession.findUnique({where:{id:first.sessionId}}))?.pushToken).toBeNull();
    expect((await put(second.accessToken,null)).status).toBe(200);await revokeByRefresh(first.refreshToken);expect((await put(first.accessToken,token)).status).toBe(401);
  });
  it('queues once, sends no private content and cancels revoked-device deliveries',async()=>{
    vi.stubEnv('MOBILE_PUSH_ENABLED','true');const fetchMock=vi.fn().mockResolvedValue({ok:true,json:async()=>({data:{status:'ok',id:'synthetic-ticket'}})});vi.stubGlobal('fetch',fetchMock);
    try{const session=(await createMobileSession(userId,'Push device'))!;await prisma.mobileSession.update({where:{id:session.sessionId},data:{pushToken:'ExpoPushToken[synthetic_fixture_token]',pushEnabledAt:new Date(0)}});
      await notify(userId,{type:'crm_lead',title:'Private customer',body:'Private financial detail'});
      const notification=(await prisma.notification.findFirst())!;
      await enqueueMobilePush(notification);await enqueueMobilePush(notification);expect(await prisma.mobileRequest.count({where:{status:'PUSH_QUEUED'}})).toBe(1);
      await dispatchMobilePush();await dispatchMobilePush();expect(fetchMock).toHaveBeenCalledTimes(1);const sent=JSON.parse(fetchMock.mock.calls[0][1].body);expect(JSON.stringify(sent)).not.toContain('Private');expect(sent.data.target).toBe('notifications');
      await prisma.mobileRequest.updateMany({where:{status:'PUSH_TICKET'},data:{updatedAt:new Date(Date.now()-20*60000)}});
      fetchMock.mockResolvedValueOnce({ok:true,json:async()=>({data:{'synthetic-ticket':{status:'error',details:{error:'DeviceNotRegistered'}}}})});
      await dispatchMobilePush();expect((await prisma.mobileSession.findUnique({where:{id:session.sessionId}}))?.pushToken).toBeNull();
      await prisma.mobileSession.update({where:{id:session.sessionId},data:{pushToken:'ExpoPushToken[synthetic_fixture_token]',pushEnabledAt:new Date(0)}});
      const next=await prisma.notification.create({data:{userId,type:'crm_lead',title:'Second'}});await enqueueMobilePush(next);await revokeByRefresh(session.refreshToken);await dispatchMobilePush();expect(fetchMock).toHaveBeenCalledTimes(2);
    }finally{vi.unstubAllGlobals();vi.stubEnv('MOBILE_PUSH_ENABLED','false');}
  });
  it('does not repeat an uncertain send or enqueue notifications without opt-in',async()=>{
    vi.stubEnv('MOBILE_PUSH_ENABLED','true');const fetchMock=vi.fn().mockRejectedValue(Error('Synthetic timeout'));vi.stubGlobal('fetch',fetchMock);
    try{const session=(await createMobileSession(userId,'Uncertain push'))!,notification=await prisma.notification.create({data:{userId,type:'fixture',title:'Fixture'}});await enqueueMobilePush(notification);expect(await prisma.mobileRequest.count()).toBe(0);await prisma.mobileSession.update({where:{id:session.sessionId},data:{pushToken:'ExpoPushToken[synthetic_fixture_token]',pushEnabledAt:new Date(0)}});await enqueueMobilePush(notification);await dispatchMobilePush();await dispatchMobilePush();expect(fetchMock).toHaveBeenCalledTimes(1);expect((await prisma.mobileRequest.findFirst())?.status).toBe('UNKNOWN');
    }finally{vi.unstubAllGlobals();vi.stubEnv('MOBILE_PUSH_ENABLED','false');}
  });
  it('allows native FIT recovery paths without granting CRM access',async()=>{const session=(await createMobileSession(userId,'FIT device'))!;await prisma.user.update({where:{id:userId},data:{accountType:'FITNESS'}});const req=new NextRequest('https://example.test/api/mobile/v1/fitness/diary',{headers:{Authorization:`Bearer ${session.accessToken}`}});expect((await requireAuth(req))?.id).toBe(userId);});
  it("returns a module permission denial without treating a valid FIT session as expired",async()=>{const session=(await createMobileSession(userId,"FIT phone"))!;await prisma.user.update({where:{id:userId},data:{accountType:'FITNESS'}});const request=new NextRequest('https://example.test/api/crm/contacts',{headers:{Authorization:`Bearer ${session.accessToken}`}});expect(await requireAuth(request)).toBeNull();expect(unauthorizedResponse(request).status).toBe(403);expect(await mobileIdentity(session.accessToken)).not.toBeNull();});
  it("accepts native bearer access only after a live session and account check", async () => {
    const session=(await createMobileSession(userId,"Test phone"))!;
    const bearer=()=>new NextRequest("https://example.test/api/user/profile",{headers:{Authorization:`Bearer ${session.accessToken}`}});
    expect((await requireAuth(bearer()))?.id).toBe(userId);
    expect(await requireAuth(new NextRequest("https://example.test/api/user/profile",{headers:{Cookie:`token=${session.accessToken}`}}))).toBeNull();
    await prisma.user.update({where:{id:userId},data:{isBlocked:true}});
    expect(await requireAuth(bearer())).toBeNull();
  });
  it("stores only a hash, and native credentials cannot enter legacy browser verification", async () => {
    const session = (await createMobileSession(userId, "Test phone"))!;
    const row = (await prisma.mobileSession.findUnique({ where: { id: session.sessionId } }))!;
    expect(row.refreshTokenHash).toBe(createHash("sha256").update(session.refreshToken).digest("hex"));
    expect(row.refreshTokenHash).not.toContain(session.refreshToken);
    expect(verifyToken(session.accessToken)).toBeNull();
    expect(verifyMobileAccess(signToken({ userId, role: "USER", plan: "FREE" }))).toBeNull();
    expect(await mobileIdentity(session.accessToken)).toEqual({ userId, sessionId: session.sessionId });
  });
  it("rotates once and revokes the session when the previous valid secret is replayed", async () => {
    const first = (await createMobileSession(userId, "Test phone"))!;
    const second = (await rotateMobileSession(first.refreshToken))!;
    expect(second.refreshToken).not.toBe(first.refreshToken);
    expect(await rotateMobileSession(first.refreshToken)).toBeNull();
    expect(await mobileIdentity(second.accessToken)).toBeNull();
    expect(await rotateMobileSession(second.refreshToken)).toBeNull();
  });
  it("does not let a guessed secret revoke a known session", async () => {
    const session = (await createMobileSession(userId, "Test phone"))!;
    expect(await rotateMobileSession(`${session.sessionId}.${"0".repeat(64)}`)).toBeNull();
    expect(await mobileIdentity(session.accessToken)).not.toBeNull();
  });
  it("revokes access server-side on logout", async () => {
    const session = (await createMobileSession(userId, "Test phone"))!;
    await revokeByRefresh(session.refreshToken);
    expect(await mobileIdentity(session.accessToken)).toBeNull();
    expect(await rotateMobileSession(session.refreshToken)).toBeNull();
  });
  it("rejects expired and blocked-account refreshes", async () => {
    const session = (await createMobileSession(userId, "Test phone"))!;
    await prisma.user.update({ where: { id: userId }, data: { isBlocked: true } });
    expect(await rotateMobileSession(session.refreshToken)).toBeNull();
    expect(await createMobileSession(userId, "Other device")).toBeNull();
    await prisma.user.update({ where: { id: userId }, data: { isBlocked: false } });
    await prisma.mobileSession.update({ where: { id: session.sessionId }, data: { expiresAt: new Date(0) } });
    expect(await rotateMobileSession(session.refreshToken)).toBeNull();
    expect(await mobileIdentity(session.accessToken)).toBeNull();
  });
  it("allows at most one concurrent rotation of a secret", async () => {
    const session = (await createMobileSession(userId, "Test phone"))!;
    const results = await Promise.all([rotateMobileSession(session.refreshToken), rotateMobileSession(session.refreshToken)]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });
  it("cascades session deletion when the account is removed", async () => {
    await createMobileSession(userId, "Test phone"); await prisma.user.delete({ where: { id: userId } });
    expect(await prisma.mobileSession.count()).toBe(0);
  });
});
