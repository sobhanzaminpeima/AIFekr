export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, forbiddenResponse } from "@/lib/auth/middleware";
import { prisma } from "@/lib/db/prisma";
import { getVapiCall } from "@/lib/voice/vapiClient";
import { voiceSettings } from "@/lib/voice/settings";
import { POST as processWebhook } from "@/app/api/webhooks/vapi/route";
export async function POST(req: NextRequest, {params}:{params:Promise<{id:string}>}) {
  if(!await requireAdmin(req))return forbiddenResponse();
  const {id}=await params;
  const record=await prisma.voiceCallLog.findUnique({where:{id}});
  if(!record)return NextResponse.json({error:"Call not found"},{status:404});
  if(record.billingStatus==="settled")return NextResponse.json({ok:true});
  if(!record.vapiCallId)return NextResponse.json({error:"گزارش هنوز نرسیده است؛ در Vapi با شناسهٔ رزرو تماس جستجو کنید و گزارش پایان را دوباره ارسال کنید. کریدت تا مشخص شدن نتیجه محفوظ می‌ماند."},{status:409});
  try {
    const call=await getVapiCall(record.vapiCallId);
    if(call.status!=="ended")return NextResponse.json({error:"تماس هنوز پایان نیافته است؛ کمی بعد دوباره بررسی کنید."},{status:409});
    const settings=await voiceSettings();
    const result=await processWebhook(new NextRequest("https://aifekr.com/api/webhooks/vapi",{method:"POST",headers:{authorization:`Bearer ${settings.webhookSecret}`,"content-type":"application/json"},body:JSON.stringify({message:{...call,type:"end-of-call-report",call}})}));
    if(!result.ok)throw new Error("Unable to settle");
    return NextResponse.json({ok:true});
  } catch{return NextResponse.json({error:"تسویه انجام نشد؛ گزارش تماس و اتصال Vapi را بررسی کنید."},{status:502});}
}
