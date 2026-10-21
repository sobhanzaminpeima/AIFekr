import {NextRequest,NextResponse} from "next/server";
import {chatIdentity} from "@/lib/ai-chat/identity";
import {prisma} from "@/lib/db/prisma";
import {z} from "zod";
export async function POST(req:NextRequest){
 if(req.headers.get("origin")&&new URL(req.headers.get("origin")!).host!==req.headers.get("host"))return NextResponse.json({error:"ORIGIN_FORBIDDEN"},{status:403});
 try{const identity=await chatIdentity(req);if(!identity?.user)return NextResponse.json({error:"AUTH_REQUIRED"},{status:401});
 const b=z.object({module:z.enum(["CHAT","BUSINESS","STUDENT","FITNESS"])}).strict().parse(await req.json());
 const account=await prisma.user.findUniqueOrThrow({where:{id:identity.user.id},select:{accountType:true,plan:true,role:true}});
 await prisma.user.update({where:{id:identity.user.id},data:{platformEntry:b.module,...(b.module!=="CHAT"?{chatOnly:false}:{}),...(b.module==="FITNESS"&&account.accountType==="PERSONAL"&&account.plan==="FREE"&&account.role==="USER"?{accountType:"FITNESS"}:{})}});
 return NextResponse.json({ok:true});
 }catch{return NextResponse.json({error:"INVALID_SELECTION"},{status:400});}
}
