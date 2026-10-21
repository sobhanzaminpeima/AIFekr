export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { activeBusinessIdFor } from "@/lib/organization/activeBusiness";
import { prisma } from "@/lib/db/prisma";

const VALID_STATUSES = ["pending", "confirmed", "completed", "cancelled", "no_show"];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  const { id } = await params;

  const existing = await prisma.voiceAppointment.findUnique({ where: { id } });
  if (!existing || (existing.userId !== user.id || existing.businessId !== await activeBusinessIdFor(user.id))) return NextResponse.json({ error: "رزرو یافت نشد" }, { status: 404 });

  const body = await req.json().catch(()=>null);
  if(!body) return NextResponse.json({error:"Invalid request"},{status:400});
  const { status, scheduledAt, notes } = body;
  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "وضعیت نامعتبر است" }, { status: 400 });
  }

  if(notes!==undefined&&notes!==null&&(typeof notes!=="string"||notes.length>10000)) return NextResponse.json({error:"Invalid notes"},{status:400});
  const time=scheduledAt===undefined?existing.scheduledAt:typeof scheduledAt==="string"&&/(?:Z|[+-]\d{2}:\d{2})$/.test(scheduledAt)?new Date(scheduledAt):new Date(NaN);
  if(!Number.isFinite(time.getTime()))return NextResponse.json({error:"Invalid appointment date"},{status:400});
  const nextStatus=status||existing.status;
  const active=["pending","confirmed"].includes(nextStatus);
  if(active&&scheduledAt!==undefined&&time.getTime()<=Date.now())return NextResponse.json({error:"Choose a future appointment"},{status:400});
  const updated=await prisma.$transaction(async tx=>{
    const agent=await tx.voiceAgent.findUniqueOrThrow({where:{id:existing.agentId}});
    if(active){
      const window=agent.appointmentMinutes*60000;
      const conflict=await tx.voiceAppointment.findFirst({where:{agentId:existing.agentId,id:{not:id},status:{in:["pending","confirmed"]},scheduledAt:{gt:new Date(time.getTime()-window),lt:new Date(time.getTime()+window)}}});
      if(conflict)return null;
    }
    return tx.voiceAppointment.update({where:{id},data:{status:nextStatus,scheduledAt:time,notes:notes===undefined?undefined:notes||null}});
  });
  if(!updated)return NextResponse.json({error:"Appointment time conflicts with another booking"},{status:409});
  return NextResponse.json({ appointment: updated });
}
