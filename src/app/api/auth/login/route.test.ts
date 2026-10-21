import { vi } from "vitest";
vi.hoisted(() => { process.env.JWT_SECRET ||= "student-auth-test-secret"; });

import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db/prisma";
import { POST } from "./route";

const userId = `login-flow-${crypto.randomUUID()}`;
const email = `${userId}@example.test`;

beforeEach(async () => {
  await prisma.user.create({ data: { id: userId, email, name: "Test Student", passwordHash: await hashPassword("Safe-test-password-938!"), language: "en" } });
});
afterEach(async () => { await prisma.user.deleteMany({ where: { id: userId } }); });
afterAll(async () => prisma.$disconnect());

describe("POST /api/auth/login", () => {
  it("authenticates a disposable student account and issues secure session cookies", async () => {
    const response = await POST(new NextRequest("https://aifekr.test/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "Safe-test-password-938!" }) }));
    expect(response.status).toBe(200);
    expect((await response.json()).user.id).toBe(userId);
    expect(response.headers.get("set-cookie")).toContain("token=");
    expect(response.headers.get("set-cookie")).toContain("refresh_token=");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  });

  it("accepts the registered email with different capitalization and surrounding whitespace", async () => {
    const response = await POST(new NextRequest("https://aifekr.test/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: `  ${email.toUpperCase()}  `, password: "Safe-test-password-938!" }) }));
    expect(response.status).toBe(200);
    expect((await response.json()).user.id).toBe(userId);
  });

  it("rejects non-string credentials as an invalid request", async () => {
    const response = await POST(new NextRequest("https://aifekr.test/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: {}, password: "Safe-test-password-938!" }) }));
    expect(response.status).toBe(400);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("rejects an incorrect password without issuing a session", async () => {
    const response = await POST(new NextRequest("https://aifekr.test/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "incorrect" }) }));
    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
