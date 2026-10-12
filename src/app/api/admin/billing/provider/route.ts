export const dynamic="force-dynamic";
import {NextRequest,NextResponse} from "next/server";
import {requireAdmin,unauthorizedResponse} from "@/lib/auth/middleware";
import {saveXeConfig,syncXeRates,publicXeStatus} from "@/lib/billing/xe";
import {rateLimit} from "@/lib/utils/rateLimit";
export async function GET(req:NextRequest){if(!await requireAdmin(req))return unauthorizedResponse(req);return NextResponse.json(await publicXeStatus());}
export async function POST(req:NextRequest){const user=await requireAdmin(req);if(!user)return unauthorizedResponse(req);if(!rateLimit("xe-admin:"+user.id,3,60000).allowed)return NextResponse.json({error:"RATE_LIMIT"},{status:429});try{const body=await req.json();if(body.action==="sync"&&Object.keys(body).length===1)return NextResponse.json({synced:await syncXeRates(true,user.id),...await publicXeStatus()});await saveXeConfig(body,user.id);return NextResponse.json(await publicXeStatus());}catch{return NextResponse.json({error:"INVALID_PROVIDER_CONFIG"},{status:400});}}
