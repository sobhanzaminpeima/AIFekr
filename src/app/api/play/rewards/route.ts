import {NextRequest,NextResponse} from "next/server";
import {requireAuth,unauthorizedResponse} from "@/lib/auth/middleware";
import {prisma} from "@/lib/db/prisma";
import {z} from "zod";
export async function POST(req:NextRequest){
 const u=await requireAuth(req);if(!u)return unauthorizedResponse(req);
 if(req.headers.get("origin")&&new URL(req.headers.get("origin")!).host!==req.headers.get("host"))return NextResponse.json({error:"ORIGIN_FORBIDDEN"},{status:403});
 try{const b=z.object({id:z.string().max(100),choice:z.enum(["STUDENT","FITNESS","BUSINESS"])}).strict().parse(await req.json());
 const changed=await prisma.playRewardGrant.updateMany({where:{id:b.id,userId:u.id,status:"APPROVED",packageChoice:"",title:"MONTHLY_PACKAGE_CHOICE"},data:{packageChoice:b.choice}});
 if(!changed.count)return NextResponse.json({error:"REWARD_NOT_SELECTABLE"},{status:409});
 return NextResponse.json({ok:true});
 }catch{return NextResponse.json({error:"INVALID_REWARD_CHOICE"},{status:400});}
}
