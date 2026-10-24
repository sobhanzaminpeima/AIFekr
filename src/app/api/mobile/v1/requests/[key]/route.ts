import {NextRequest,NextResponse} from "next/server";
import {requireAuth,unauthorizedResponse} from "@/lib/auth/middleware";
import {prisma} from "@/lib/db/prisma";
import {publicRequestResult} from "@/lib/mobile/requestResult";
export const dynamic="force-dynamic";
export async function GET(req:NextRequest, props:{params: Promise<{key:string}>}) {
  const params = await props.params;
  const user=await requireAuth(req);if(!user)return unauthorizedResponse(req);const row=await prisma.mobileRequest.findUnique({where:{userId_requestKey:{userId:user.id,requestKey:params.key}},select:{status:true,responseJson:true,createdAt:true,updatedAt:true}});if(!row)return NextResponse.json({error:"Not found"},{status:404});return NextResponse.json({status:row.status,result:publicRequestResult(row.status,row.responseJson),updatedAt:row.updatedAt},{headers:{"Cache-Control":"no-store"}});
}

