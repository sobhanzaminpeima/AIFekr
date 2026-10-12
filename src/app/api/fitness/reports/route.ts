export const dynamic="force-dynamic";
import {NextRequest,NextResponse} from "next/server";
import {requireAuth,unauthorizedResponse} from "@/lib/auth/middleware";
import {fitnessAccess} from "@/lib/fitness/service";
import {fitnessReport} from "@/lib/fitness/reports";
export async function GET(req:NextRequest){const u=await requireAuth(req);if(!u)return unauthorizedResponse(req);if(!await fitnessAccess(u.id,u.role))return NextResponse.json({error:"FITNESS_SUBSCRIPTION_REQUIRED"},{status:402});return NextResponse.json(await fitnessReport(u.id,req.nextUrl.searchParams.get("period")==="month"?"month":"week"));}
