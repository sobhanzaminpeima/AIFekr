import {createHash} from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
import {Prisma} from "@prisma/client";
import {z} from "zod";
import {POST as chat} from "@/app/api/chat/route";
import {requireAuth,unauthorizedResponse} from "@/lib/auth/middleware";
import {prisma} from "@/lib/db/prisma";
import {mobileChatQuote} from "@/lib/ai/mobileChatQuote";
export const dynamic="force-dynamic";
const input=z.object({message:z.string().trim().min(1).max(12000),conversationId:z.string().max(100).optional(),history:z.array(z.object({role:z.enum(["user","assistant"]),content:z.string().max(16000)})).max(10).default([]),acceptedMaxCredits:z.number().int().nonnegative(),requestKey:z.string().regex(/^[a-zA-Z0-9_-]{12,100}$/)}).strict();
function cachedStream(raw:string){const result=JSON.parse(raw);return new Response(`data: ${JSON.stringify({text:result.text})}\n\ndata: [DONE]\n\n`,{headers:{"Content-Type":"text/event-stream","Cache-Control":"no-store","X-Accel-Buffering":"no","X-Conversation-Id":result.conversationId||""}});}
export async function POST(req:NextRequest){
 if(process.env.MOBILE_API_ENABLED!=="true")return NextResponse.json({error:"Mobile access is not enabled"},{status:503});
 const user=await requireAuth(req);if(!user)return unauthorizedResponse(req);
 const parsed=input.safeParse(await req.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:"Invalid chat request"},{status:400});
 const body=parsed.data;
 const hash=createHash("sha256").update(JSON.stringify({message:body.message,conversationId:body.conversationId,history:body.history})).digest("hex");
 const prior=await prisma.mobileRequest.findUnique({where:{userId_requestKey:{userId:user.id,requestKey:body.requestKey}}});
 if(prior){if(prior.inputHash!==hash)return NextResponse.json({error:"Request key already used for different content"},{status:409});if(prior.status==="COMPLETED"&&prior.responseJson)return cachedStream(prior.responseJson);return NextResponse.json({error:"Request already submitted; check its status",status:prior.status,requestKey:body.requestKey},{status:409});}
 const quote=await mobileChatQuote();if(body.acceptedMaxCredits<quote.maxCredits)return NextResponse.json({error:"Credit estimate changed; review again",quote},{status:409});
 let claim;
 try{claim=await prisma.mobileRequest.create({data:{userId:user.id,requestKey:body.requestKey,inputHash:hash}});}catch(error){if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==="P2002")return NextResponse.json({error:"Request already in progress"},{status:409});throw error;}
 try{
  const upstream=await chat(new NextRequest(req.url,{method:"POST",headers:req.headers,body:JSON.stringify({message:body.message,conversationId:body.conversationId,history:body.history,model:"auto",disableTools:true})}));
  if(!upstream.ok||!upstream.body){await prisma.mobileRequest.update({where:{id:claim.id},data:{status:"FAILED"}});return upstream;}
  const reader=upstream.body.getReader(),encoder=new TextEncoder(),decoder=new TextDecoder();let content="",pending="",failed=false,complete=false;
  const stream=new ReadableStream({async start(controller){try{while(true){const {done,value}=await reader.read();if(done)break;pending+=decoder.decode(value,{stream:true});let i;while((i=pending.indexOf("\n\n"))>=0){const frame=pending.slice(0,i);pending=pending.slice(i+2);const data=frame.replace(/^data: /,"");if(data==="[DONE]"){complete=true;continue;}try{const event=JSON.parse(data);if(event.reset)content="";if(event.text)content+=event.text;if(event.error)failed=true;}catch{failed=true;}}if(content.length>1000000)throw new Error("Response limit exceeded");controller.enqueue(value);}
   await prisma.mobileRequest.update({where:{id:claim.id},data:{status:failed||!complete?"FAILED":"COMPLETED",responseJson:JSON.stringify({text:content,conversationId:upstream.headers.get("X-Conversation-Id")})}});controller.close();
  }catch{await prisma.mobileRequest.updateMany({where:{id:claim.id,status:"RUNNING"},data:{status:"UNKNOWN"}});try{controller.enqueue(encoder.encode(`data: ${JSON.stringify({error:"Connection interrupted. Check conversation history before retrying."})}\n\n`));controller.close();}catch{/* Client disconnected. Durable state remains queryable. */}}}});
  return new Response(stream,{headers:{"Content-Type":"text/event-stream","Cache-Control":"no-store","X-Accel-Buffering":"no","X-Conversation-Id":upstream.headers.get("X-Conversation-Id")||""}});
 }catch{await prisma.mobileRequest.updateMany({where:{id:claim.id,status:"RUNNING"},data:{status:"UNKNOWN"}});return NextResponse.json({error:"Chat interrupted; check request status before retrying"},{status:502});}
}
