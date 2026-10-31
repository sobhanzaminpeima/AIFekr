export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const tasks = await prisma.ceoTask.findMany({
    where: { userId: user.id, ...(status && status !== "all" ? { status } : {}) },
    orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
    take: 50,
  });

  return NextResponse.json({ tasks });
}

export async function PUT(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);

  const { id, status } = await req.json();
  if (!id || !status) return NextResponse.json({ error: "id and status required" }, { status: 400 });
  if(!["pending","approved","in_progress","done","rejected"].includes(status))return NextResponse.json({error:"INVALID_STATUS"},{status:400});

  const task = await prisma.ceoTask.updateMany({
    where: { id, userId: user.id },
    data: { status, updatedAt: new Date() },
  });

  if(!task.count)return NextResponse.json({error:"Not found"},{status:404});
  return NextResponse.json({ ok: true, updated: task.count });
}

export async function POST(req:NextRequest){
 const user=await requireAuth(req);if(!user)return unauthorizedResponse(req);
 const b=await req.json().catch(()=>null);
 if(typeof b?.title!=="string"||!b.title.trim()||b.title.length>300)return NextResponse.json({error:"INVALID_TITLE"},{status:400});
 const task=await prisma.ceoTask.create({data:{userId:user.id,title:b.title.trim(),description:typeof b.description==="string"?b.description.slice(0,4000):null,department:typeof b.department==="string"?b.department.slice(0,80):"general",priority:["critical","high","medium","low"].includes(b.priority)?b.priority:"medium",status:"pending",source:"user"}});
 return NextResponse.json({task},{status:201});
}

export async function DELETE(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);

  const { id } = await req.json();
  await prisma.ceoTask.deleteMany({ where: { id, userId: user.id } });
  return NextResponse.json({ ok: true });
}
