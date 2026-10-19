export const dynamic="force-dynamic";
import {NextRequest,NextResponse} from "next/server";
import {requireAuth,unauthorizedResponse} from "@/lib/auth/middleware";
import {getCloudflareConfig} from "@/lib/cloudflare/config";
export async function GET(req:NextRequest){if(!await requireAuth(req))return unauthorizedResponse(req);const config=await getCloudflareConfig();return NextResponse.json({integration:{id:"cloudflare",available:config.enabled&&config.status==="ACTIVE",status:config.status,lastCheckedAt:config.lastCheckedAt}});}
