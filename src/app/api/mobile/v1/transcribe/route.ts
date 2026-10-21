import {NextRequest,NextResponse} from "next/server";
import {requireAuth,unauthorizedResponse} from "@/lib/auth/middleware";
import {rateLimit} from "@/lib/utils/rateLimit";
import {validAudio,transcriptionQuote,transcribeMobile} from "@/lib/mobile/transcription";
export const dynamic="force-dynamic";
export async function GET(req:NextRequest){const user=await requireAuth(req);if(!user)return unauthorizedResponse(req);return NextResponse.json(await transcriptionQuote(),{headers:{"Cache-Control":"no-store"}});}
export async function POST(req:NextRequest){
 if(process.env.MOBILE_API_ENABLED!=="true")return NextResponse.json({error:"Mobile disabled"},{status:503});
 const user=await requireAuth(req);if(!user)return unauthorizedResponse(req);
 if(!rateLimit(`mobile-transcribe:${user.id}`,5,60000).allowed)return NextResponse.json({error:"Too many requests"},{status:429});
 const form=await req.formData().catch(()=>null);const file=form?.get("file"),key=form?.get("requestKey"),accepted=Number(form?.get("acceptedCredits")),locale=req.cookies.get("lang")?.value||"en";
 if(!(file instanceof File)||!validAudio(file)||typeof key!=="string"||!/^transcribe_[a-zA-Z0-9_-]{12,100}$/.test(key)||!Number.isSafeInteger(accepted)||accepted<0||!form?.get("acceptedCredits"))return NextResponse.json({error:"Invalid audio, cost consent or request key"},{status:400});
 try{const result=await transcribeMobile(user.id,file,key,accepted,locale);return NextResponse.json(result.body,{status:result.status,headers:{"Cache-Control":"no-store"}});}catch{return NextResponse.json({error:"Transcription interrupted; check request status before retrying"},{status:503});}
}
