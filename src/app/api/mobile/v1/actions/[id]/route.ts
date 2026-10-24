import {NextRequest,NextResponse} from "next/server";
import {requireAuth,unauthorizedResponse} from "@/lib/auth/middleware";
import {accessibleMobileActions} from "@/lib/mobile/actions";
import {getServerLang} from "@/lib/i18n/server";
import {POST as confirm,DELETE as reject} from "@/app/api/orchestrator/action/[id]/route";
export const dynamic="force-dynamic";
export async function POST(req:NextRequest, props:{params: Promise<{id:string}>}) {
  const params = await props.params;
  const user=await requireAuth(req);if(!user)return unauthorizedResponse(req);const body=await req.json().catch(()=>null);if(!['confirm','reject'].includes(body?.decision)||typeof body?.reviewedSummary!=='string')return NextResponse.json({error:'Review and decision are required'},{status:400});const [action]=await accessibleMobileActions(user,await getServerLang(),params.id);if(!action)return NextResponse.json({error:'Not found'},{status:404});if(action.summary!==body.reviewedSummary)return NextResponse.json({error:'Action preview changed; review again'},{status:409});return (body.decision==='confirm'?confirm:reject)(req,{params:Promise.resolve(params)});
}
