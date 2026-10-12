export const dynamic="force-dynamic";
import {NextRequest,NextResponse} from "next/server";
import {isCronAuthorized} from "@/lib/auth/cronAuth";
import {syncXeRates} from "@/lib/billing/xe";
export async function GET(req:NextRequest){if(!isCronAuthorized(req))return NextResponse.json({error:"Unauthorized"},{status:401});return NextResponse.json({synced:await syncXeRates()});}
