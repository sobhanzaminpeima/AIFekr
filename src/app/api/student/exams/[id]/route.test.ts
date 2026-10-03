import { vi } from "vitest";
vi.hoisted(() => { process.env.JWT_SECRET ||= "student-exam-test-secret"; });
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { signToken } from "@/lib/auth/jwt";
import { prisma } from "@/lib/db/prisma";
import { PATCH, DELETE } from "./route";
const owner = `exam-owner-${crypto.randomUUID()}`, stranger = `exam-other-${crypto.randomUUID()}`;
let examId: string;
function request(userId: string | null, method: string, body?: unknown) { return new NextRequest(`https://aifekr.test/api/student/exams/${examId}`, { method, headers: userId ? { Cookie: `token=${signToken({ userId, role: "USER", plan: "FREE" })}`, "Content-Type": "application/json" } : {}, ...(body ? { body: JSON.stringify(body) } : {}) }); }
beforeAll(async () => {
 await prisma.user.createMany({ data: [{id:owner},{id:stranger}] });
 const course = await prisma.studentCourse.create({ data: { userId: owner, name: "Physics" } });
 const exam = await prisma.studentExam.create({ data: { userId: owner, courseId: course.id, title: "Midterm", examAt: new Date("2026-11-01T12:00:00Z") } }); examId=exam.id;
});
afterAll(async () => { await prisma.studentCourse.deleteMany({where:{userId:owner}}); await prisma.user.deleteMany({where:{id:{in:[owner,stranger]}}}); });
describe("student exam edits and deletion",()=>{
 it("rejects unauthenticated mutation",async()=>{ expect((await DELETE(request(null,"DELETE"),{params:{id:examId}})).status).toBe(401); });
 it("hides other students' exams from edit and delete",async()=>{
 expect((await PATCH(request(stranger,"PATCH",{title:"Stolen",examAt:"2026-12-01T10:00:00Z"}),{params:{id:examId}})).status).toBe(404);
 expect((await DELETE(request(stranger,"DELETE"),{params:{id:examId}})).status).toBe(404);
 expect((await prisma.studentExam.findUniqueOrThrow({where:{id:examId}})).title).toBe("Midterm");
 });
 it("rejects invalid dates and nonstring titles",async()=>{ for (const body of [{title:123,examAt:"2026-12-01"},{title:"Test",examAt:"invalid"}]) expect((await PATCH(request(owner,"PATCH",body),{params:{id:examId}})).status).toBe(400); });
 it("updates the owner's exam and removes it",async()=>{
 expect((await PATCH(request(owner,"PATCH",{title:"Final",examAt:"2026-12-01T10:00:00Z"}),{params:{id:examId}})).status).toBe(200);
 const row=await prisma.studentExam.findUniqueOrThrow({where:{id:examId}}); expect(row.title).toBe("Final"); expect(row.examAt.toISOString()).toBe("2026-12-01T10:00:00.000Z");
 expect((await DELETE(request(owner,"DELETE"),{params:{id:examId}})).status).toBe(200); expect(await prisma.studentExam.findUnique({where:{id:examId}})).toBeNull();
 });
});
