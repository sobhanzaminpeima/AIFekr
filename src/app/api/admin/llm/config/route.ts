export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { PROVIDERS } from "@/lib/ai/providers";
import { getDisabledProviders, refreshDisabledProviders, setProviderEnabled } from "@/lib/ai/providerConfig";
import { isTypeSafeConfigured } from "@/lib/ai/typesafe";
import {prisma} from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
    return unauthorizedResponse(req);
  }
  // The admin page used to keep its own hardcoded provider list -- eight
  // entries frozen at whatever the router looked like the day that page was
  // written, missing Claude, Groq, Cohere and every Mistral-family model that
  // real users actually see in the chat model picker (13 of them, added
  // later straight into src/lib/ai/providers.ts). Sourcing from PROVIDERS
  // here means this list can't drift from what's actually live again.
  const providers = PROVIDERS.map((p) => ({
    id: p.id, name: p.name, provider: p.provider, model: p.model, strengths: p.strengths,
    maxTokens: p.maxTokens, creditCost: p.creditCost, configured: p.apiKey.length > 10, kind: "chat",
  }));
  // Jev deliberately stays out of PROVIDERS: it is not OpenAI-compatible and
  // cannot generate a chat reply. Showing it here keeps its health visible
  // without ever routing a user's chat message to an incompatible API.
  providers.push({
    id: "typesafe-jev", name: "TypeSafe Jev", provider: "typesafe", model: "jev-latest",
    strengths: ["structured", "classification", "fast"], maxTokens: 0, creditCost: 0,
    configured: isTypeSafeConfigured, kind: "structured-decision",
  });
  await refreshDisabledProviders();
  const custom=await prisma.customAiProvider.findMany({where:{type:"chat"},orderBy:{createdAt:"desc"}});
  const customProviders=custom.map(p=>({id:`custom:${p.id}`,name:p.name,provider:"custom",model:p.model,strengths:["general","creative","code"],maxTokens:4096,creditCost:3,configured:!!p.apiKey,kind:"chat"}));
  return NextResponse.json({ disabled: [...Array.from(getDisabledProviders()),...custom.filter(p=>!p.enabled).map(p=>`custom:${p.id}`)], providers:[...providers,...customProviders] });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
    return unauthorizedResponse(req);
  }

  const { providerId, enabled } = await req.json();
  if (!providerId || typeof providerId !== "string") {
    return NextResponse.json({ ok: false, error: "Missing providerId" }, { status: 400 });
  }
  if(providerId.startsWith("custom:")){
    const id=providerId.slice(7),row=await prisma.customAiProvider.findUnique({where:{id}});
    if(!row||row.type!=="chat")return NextResponse.json({ok:false,error:"Unknown providerId"},{status:400});
    await prisma.customAiProvider.update({where:{id},data:{enabled:Boolean(enabled)}});
    await prisma.auditLog.create({data:{actorId:user.id,action:"llm.provider_toggled",targetId:id,metadata:JSON.stringify({enabled:Boolean(enabled)})}});
    const custom=await prisma.customAiProvider.findMany({where:{type:"chat",enabled:false},select:{id:true}});
    return NextResponse.json({ok:true,disabled:[...Array.from(getDisabledProviders()),...custom.map(p=>`custom:${p.id}`)]});
  }
  if (!PROVIDERS.some((p) => p.id === providerId) && providerId !== "typesafe-jev") {
    return NextResponse.json({ ok: false, error: "Unknown providerId" }, { status: 400 });
  }

  const disabled = await setProviderEnabled(providerId, Boolean(enabled));
  return NextResponse.json({ ok: true, disabled });
}
