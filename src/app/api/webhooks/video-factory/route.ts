import {NextRequest,NextResponse} from "next/server";
import {acceptFactoryWebhook} from "@/lib/video-factory/webhooks";
import {FactoryError} from "@/lib/video-factory/domain";
export const dynamic="force-dynamic";
export async function POST(req:NextRequest){
  if(!process.env.VIDEO_FACTORY_WEBHOOK_SECRET)return NextResponse.json({code:"WEBHOOK_NOT_CONFIGURED"},{status:503});
  const reader=req.body?.getReader();if(!reader)return NextResponse.json({code:"INVALID_BODY"},{status:400});const chunks:Uint8Array[]=[];let size=0;
  while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>262144){await reader.cancel();return NextResponse.json({code:"BODY_TOO_LARGE"},{status:413});}chunks.push(part.value);}
  try{return NextResponse.json(await acceptFactoryWebhook(Buffer.concat(chunks).toString("utf8"),req.headers,process.env.VIDEO_FACTORY_WEBHOOK_SECRET));}catch(error){return NextResponse.json({code:error instanceof FactoryError?error.code:"INVALID_WEBHOOK"},{status:error instanceof FactoryError?error.status:400});}
}
