export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, unauthorizedResponse } from "@/lib/auth/middleware";
import { PROVIDERS, streamOpenAICompat } from "@/lib/ai/providers";
import { evaluateWithTypeSafe, isTypeSafeConfigured } from "@/lib/ai/typesafe";
import {prisma} from "@/lib/db/prisma";
import {resolveCustomApiKey} from "@/lib/ai/customCredentials";

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
    return unauthorizedResponse(req);
  }

  const { searchParams } = new URL(req.url);
  const providerId = searchParams.get("provider");
  if(providerId?.startsWith("custom:")){
    const row=await prisma.customAiProvider.findUnique({where:{id:providerId.slice(7)}});
    if(!row||row.type!=="chat")return NextResponse.json({ok:false,error:"Provider not found"},{status:404});
    if(!row.enabled)return NextResponse.json({ok:false,error:"Enable this model before running a paid test"},{status:409});
    try{let got="";await streamOpenAICompat({id:providerId,name:row.name,model:row.model,provider:"custom",baseURL:row.baseUrl,apiKey:await resolveCustomApiKey(row.apiKey),strengths:[],maxTokens:32,creditCost:3},[{role:"user",content:"Say OK"}],"Reply with OK only",s=>{got+=s;});return NextResponse.json({ok:true,response:got.slice(0,100)});}catch{return NextResponse.json({ok:false,error:"Provider connection failed; verify credentials and account access"});}
  }

  if (providerId === "typesafe-jev") {
    if (!isTypeSafeConfigured) return NextResponse.json({ ok: false, error: "API key not configured" });
    try {
      const result = await evaluateWithTypeSafe("The customer says: I need help with my payment immediately.", {
        urgency: { type: "noul", instructions: "Does this message express urgency?" },
      });
      return NextResponse.json({ ok: true, response: JSON.stringify(result.answers).slice(0, 100) });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ ok: false, error: msg.slice(0, 200) });
    }
  }

  const provider = PROVIDERS.find((p) => p.id === providerId);
  if (!provider) return NextResponse.json({ ok: false, error: "Provider not found" }, { status: 404 });

  if (!provider.apiKey || provider.apiKey.length < 10) {
    return NextResponse.json({ ok: false, error: "API key not configured" });
  }

  const testMessages = [{ role: "user" as const, content: "Say: OK" }];

  try {
    let got = "";
    await streamOpenAICompat(provider, testMessages, "You are a test assistant. Reply with just: OK", (t) => { got += t; });
    return NextResponse.json({ ok: true, response: got.slice(0, 100) });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg.slice(0, 200) });
  }
}
