export const dynamic="force-dynamic";
import {NextRequest,NextResponse} from "next/server";
import {requireAdmin,unauthorizedResponse} from "@/lib/auth/middleware";
import {probeWorkersAi} from "@/lib/cloudflare/workersAi";
export async function GET(req:NextRequest){if(!await requireAdmin(req))return unauthorizedResponse(req);try{return NextResponse.json(await probeWorkersAi());}catch{return NextResponse.json({available:false,error:"CLOUDFLARE_WORKERS_AI_UNAVAILABLE"},{status:502});}}
