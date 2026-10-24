export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { updateUserAsAdmin, deleteUserAsAdmin, PhoneAlreadyInUseError, assertAdminMayManage, AdminPermissionError, AdminValidationError } from "@/lib/repositories/adminRepository";

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const admin = await requireAdmin(req);
  if (!admin) {
    const user = await (await import("@/lib/auth/middleware")).requireAuth(req);
    return user ? forbiddenResponse() : unauthorizedResponse(req);
  }

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    include: {
      _count: { select: { conversations: true, images: true, videos: true, payments: true } },
      payments: { take: 20, orderBy: { createdAt: "desc" }, select: {id:true,amount:true,plan:true,status:true,gateway:true,refId:true,createdAt:true,transferMinor:true,transferCurrency:true,receiptAt:true,reviewNote:true} },
      usageLogs: { take: 20, orderBy: { createdAt: "desc" } },
    },
  });

  if (!user) return NextResponse.json({ error: "کاربر یافت نشد" }, { status: 404 });
  const history=await prisma.auditLog.findMany({where:{targetId:params.id},orderBy:{createdAt:"desc"},take:100,select:{id:true,action:true,createdAt:true,actorId:true}});
  const events=[...history,{id:"registered",action:"account_registered",createdAt:user.createdAt,actorId:user.id},...(user.lastLoginAt?[{id:"last-login",action:"last_login",createdAt:user.lastLoginAt,actorId:user.id}]:[]),...user.payments.map(p=>({id:`payment-${p.id}`,action:`payment_${p.status.toLowerCase()}`,createdAt:p.createdAt,actorId:user.id})),...user.usageLogs.map(u=>({id:`usage-${u.id}`,action:`usage_${u.type}`,createdAt:u.createdAt,actorId:user.id}))].sort((a,b)=>b.createdAt.getTime()-a.createdAt.getTime());
  const safeUser={...user,passwordHash:undefined};
  return NextResponse.json({ user:safeUser,history:events });
}

export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const admin = await requireAdmin(req);
  if (!admin) {
    const user = await (await import("@/lib/auth/middleware")).requireAuth(req);
    return user ? forbiddenResponse() : unauthorizedResponse(req);
  }

  const body = await req.json();
  if(body.accountType!==undefined&&!["PERSONAL","STUDENT","BUSINESS"].includes(body.accountType))return NextResponse.json({error:"نوع حساب نامعتبر است"},{status:400});
  if (Object.prototype.hasOwnProperty.call(body, "planExpiry")) {
    if (body.planExpiry === null || body.planExpiry === "") {
      body.planExpiry = null;
    } else if (typeof body.planExpiry === "string") {
      const planExpiry = new Date(body.planExpiry);
      if (Number.isNaN(planExpiry.getTime())) {
        return NextResponse.json({ error: "تاریخ انقضا معتبر نیست" }, { status: 400 });
      }
      body.planExpiry = planExpiry;
    } else {
      return NextResponse.json({ error: "قالب تاریخ انقضا معتبر نیست" }, { status: 400 });
    }
  }
  try {
    const before = await assertAdminMayManage(admin, params.id, body);
    const user = await updateUserAsAdmin(params.id, body);
    // Role and credit changes record old -> new so they can be reconciled later.
    const changes = { ...("role" in body && body.role !== before.role ? { role: { from: before.role, to: body.role } } : {}), ...("credits" in body && body.credits !== before.credits ? { credits: { from: before.credits, to: body.credits } } : {}) };
    await prisma.auditLog.create({data:{actorId:admin.id,action:"account_updated",targetId:params.id,metadata:JSON.stringify({fields:Object.keys(body).filter(k=>!["password","passwordHash"].includes(k)),changes})}});
    return NextResponse.json({ user:{id:user.id} });
  } catch (err) {
    if (err instanceof PhoneAlreadyInUseError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    if (err instanceof AdminPermissionError) return NextResponse.json({ error: "Only a super admin can do this", code: err.message }, { status: 403 });
    if (err instanceof AdminValidationError) return NextResponse.json({ error: "Invalid value", code: err.message }, { status: err.message === "USER_NOT_FOUND" ? 404 : 400 });
    throw err;
  }
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const admin = await requireAdmin(req);
  if (!admin) {
    const user = await (await import("@/lib/auth/middleware")).requireAuth(req);
    return user ? forbiddenResponse() : unauthorizedResponse(req);
  }

  try {
    const before = await assertAdminMayManage(admin, params.id, null);
    await prisma.auditLog.create({ data: { actorId: admin.id, action: "account_deleted", targetId: params.id, metadata: JSON.stringify({ role: before.role }) } });
    await deleteUserAsAdmin(params.id);
  } catch (err) {
    if (err instanceof AdminPermissionError) return NextResponse.json({ error: "Only a super admin can do this", code: err.message }, { status: 403 });
    if (err instanceof AdminValidationError) return NextResponse.json({ error: "User not found" }, { status: 404 });
    throw err;
  }
  return NextResponse.json({ success: true });
}
