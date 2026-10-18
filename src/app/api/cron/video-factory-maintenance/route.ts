import {NextRequest,NextResponse} from "next/server";
import {isCronAuthorized} from "@/lib/auth/cronAuth";
import {expireHolds,retentionSweep} from "@/lib/video-factory/operations";
import {prisma} from "@/lib/db/prisma";
export const dynamic="force-dynamic";
export async function POST(req:NextRequest){if(!isCronAuthorized(req))return NextResponse.json({code:"UNAUTHORIZED"},{status:401});try{const holdsExpired=await expireHolds(),retention=await retentionSweep("system:video_factory"),webhooks=await prisma.videoFactoryWebhookEvent.deleteMany({where:{createdAt:{lt:new Date(Date.now()-7*86400000)}}});return NextResponse.json({holdsExpired,retention,expiredWebhookReceipts:webhooks.count});}catch{return NextResponse.json({code:"MAINTENANCE_FAILED"},{status:503});}}
