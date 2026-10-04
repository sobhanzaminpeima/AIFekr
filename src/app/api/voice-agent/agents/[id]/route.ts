export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { activeBusinessIdFor } from "@/lib/organization/activeBusiness";
import { prisma } from "@/lib/db/prisma";
import { deleteVapiAssistant, releasePhoneNumber, upsertVapiAssistant } from "@/lib/voice/vapiClient";

async function loadOwnedAgent(userId: string, id: string) {
  const agent = await prisma.voiceAgent.findUnique({ where: { id } });
  if (!agent || (agent.userId !== userId || agent.businessId !== await activeBusinessIdFor(userId))) return null;
  return agent;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  const { id } = await params;

  const agent = await loadOwnedAgent(user.id, id);
  if (!agent) return NextResponse.json({ error: "ایجنت یافت نشد" }, { status: 404 });

  const body = await req.json().catch(()=>null);
  if(!body) return NextResponse.json({error:"Invalid request"},{status:400});
  const { name, systemPrompt, voiceId, isActive } = body;
  if(name!==undefined&&(typeof name!=="string"||!name.trim()||name.length>150))return NextResponse.json({error:"Invalid name"},{status:400});
  const language=body.language??agent.language,timezone=body.timezone??agent.timezone;
  const openingHour=body.openingHour??agent.openingHour,closingHour=body.closingHour??agent.closingHour,appointmentMinutes=body.appointmentMinutes??agent.appointmentMinutes;
  if(!["fa","en","de","tr"].includes(language)||typeof timezone!=="string"||!Number.isInteger(openingHour)||!Number.isInteger(closingHour)||openingHour<0||closingHour>24||openingHour>=closingHour||![15,30,45,60].includes(appointmentMinutes))return NextResponse.json({error:"Invalid reception schedule"},{status:400});
  try{new Intl.DateTimeFormat("en",{timeZone:timezone}).format();}catch{return NextResponse.json({error:"Invalid timezone"},{status:400});}

  if(voiceId!==undefined&&voiceId!==null&&typeof voiceId!=="string") return NextResponse.json({error:"Invalid voice"},{status:400});
  if(systemPrompt!==undefined&&(typeof systemPrompt!=="string"||!systemPrompt.trim()||systemPrompt.length>20000)) return NextResponse.json({error:"Invalid prompt"},{status:400});
  if(agent.vapiAssistantId && (systemPrompt!==undefined||name!==undefined||voiceId!==undefined||body.language!==undefined||body.timezone!==undefined)) {
    try {await upsertVapiAssistant({name:typeof name==="string"?name:agent.name,systemPrompt:typeof systemPrompt==="string"?systemPrompt:agent.systemPrompt,voiceId:voiceId===undefined?agent.voiceId:voiceId,vertical:agent.vertical,language,timezone,serverUrl:`${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/vapi`},agent.vapiAssistantId);}
    catch{return NextResponse.json({error:"Provider update failed; saved settings unchanged. Retry."},{status:502});}
  }
  const updated = await prisma.voiceAgent.update({
    where: { id },
    data: {
      language,timezone,openingHour,closingHour,appointmentMinutes,
      name: typeof name === "string" && name.trim() ? name.trim() : undefined,
      systemPrompt: typeof systemPrompt === "string" && systemPrompt.trim() ? systemPrompt.trim() : undefined,
      voiceId: voiceId === undefined ? undefined : voiceId || null,
      isActive: typeof isActive === "boolean" ? isActive : undefined,
    },
  });
  return NextResponse.json({ agent: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth(req);
  if (!user) return unauthorizedResponse(req);
  const { id } = await params;

  const agent = await loadOwnedAgent(user.id, id);
  if (!agent) return NextResponse.json({ error: "ایجنت یافت نشد" }, { status: 404 });

  if(await prisma.voiceCallLog.count({where:{agentId:id}})>0 || await prisma.voiceAppointment.count({where:{agentId:id}})>0) return NextResponse.json({error:"برای حفظ سوابق تماس و نوبت، این ایجنت را غیرفعال کنید؛ حذف سوابق مجاز نیست."},{status:409});
  try {
    if(agent.vapiPhoneNumberId) await releasePhoneNumber(agent.vapiPhoneNumberId);
    if(agent.vapiAssistantId) await deleteVapiAssistant(agent.vapiAssistantId);
  } catch {return NextResponse.json({error:"Phone detachment failed. Retry before deleting the agent."},{status:502});}
  await prisma.voiceAgent.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
