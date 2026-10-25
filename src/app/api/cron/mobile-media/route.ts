import {NextRequest,NextResponse} from "next/server";
import {isCronAuthorized} from "@/lib/auth/cronAuth";
import {prisma} from "@/lib/db/prisma";
import {mobileMediaStatus} from "@/lib/mobile/media";
export const dynamic="force-dynamic";
export async function GET(req:NextRequest){if(!isCronAuthorized(req))return NextResponse.json({error:'Unauthorized'},{status:401});if(process.env.MOBILE_API_ENABLED!=='true')return NextResponse.json({enabled:false});const rows=await prisma.mobileRequest.findMany({where:{status:'PROVIDER_PENDING',requestKey:{startsWith:'media_'}},select:{userId:true,requestKey:true},orderBy:{updatedAt:'asc'},take:20});const outcomes=[];for(const row of rows){try{const result=await mobileMediaStatus(row.userId,row.requestKey);outcomes.push({status:'status' in result.body?result.body.status:'UNAVAILABLE'});}catch{outcomes.push({status:'UNAVAILABLE'});}}return NextResponse.json({processed:outcomes.length,outcomes});}
