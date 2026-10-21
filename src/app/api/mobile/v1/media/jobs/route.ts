import {NextRequest,NextResponse} from "next/server";
import {requireAuth,unauthorizedResponse} from "@/lib/auth/middleware";
import {prisma} from "@/lib/db/prisma";
export const dynamic="force-dynamic";
export async function GET(req:NextRequest){const user=await requireAuth(req);if(!user)return unauthorizedResponse(req);const rows=await prisma.mobileRequest.findMany({where:{userId:user.id,requestKey:{startsWith:'media_'}},orderBy:{createdAt:'desc'},take:30,select:{requestKey:true,status:true,responseJson:true,createdAt:true}});return NextResponse.json({jobs:rows.flatMap(row=>{try{const payload=JSON.parse(row.responseJson||'null');if(payload?.kind!=='media')return [];return [{requestKey:row.requestKey,status:row.status,type:payload.type,creditsUsed:payload.credits,output:row.status==='COMPLETED'?payload.output:[],createdAt:row.createdAt}];}catch{return [];}})},{headers:{'Cache-Control':'no-store'}});}
