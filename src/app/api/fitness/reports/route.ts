import {getServerLang} from "@/lib/i18n/server";
import {localizeFitnessProgram} from "@/lib/fitness/programCopy";
export const dynamic="force-dynamic";
import {NextRequest,NextResponse} from "next/server";
import {requireAuth,unauthorizedResponse} from "@/lib/auth/middleware";
import {fitnessAccess} from "@/lib/fitness/service";
import {fitnessReport} from "@/lib/fitness/reports";
export async function GET(req:NextRequest){const u=await requireAuth(req);if(!u)return unauthorizedResponse(req);if(!await fitnessAccess(u.id,u.role))return NextResponse.json({error:"FITNESS_SUBSCRIPTION_REQUIRED"},{status:402});const report=await fitnessReport(u.id,req.nextUrl.searchParams.get("period")==="month"?"month":"week"),lang=await getServerLang();return NextResponse.json({...report,programs:report.programs.map(p=>({...p,title:localizeFitnessProgram({id:p.programId,title:p.title,description:""},lang).title}))});}
