export const dynamic="force-dynamic";
import {NextRequest,NextResponse} from 'next/server';
import {requireAuth,unauthorizedResponse} from '@/lib/auth/middleware';
import {GENERAL_AGENT_CATALOG} from '@/lib/team/agentCatalog';
import {REAL_ESTATE_MODULES} from '@/lib/industry/moduleRegistry';
import {getModuleAccessMap} from '@/lib/industry/moduleAccess';
import {resolveCrmWorkspace} from '@/lib/crm/workspace';
import {prisma} from '@/lib/db/prisma';
import {homePayload} from '@/lib/home/homePayload';
import {getServerLang} from '@/lib/i18n/server';
export async function GET(req:NextRequest){
 const user=await requireAuth(req);if(!user)return unauthorizedResponse(req);
 const [home,ws,lang]=await Promise.all([homePayload(user),resolveCrmWorkspace(user.id),getServerLang()]);
 const owner=await prisma.user.findUnique({where:{id:ws.workspaceUserId},select:{industryPackId:true}});
 const industry=REAL_ESTATE_MODULES.filter(m=>m.category==='agent');const access=await getModuleAccessMap({id:user.id,role:user.role,industryPackId:owner?.industryPackId??null},industry.map(m=>m.key));
 const label=(fa:string,en:string,de?:string)=>lang==='fa'?fa:lang==='de'&&de?de:en;
 const general=GENERAL_AGENT_CATALOG.filter(a=>a.key==='voice-agent'?home.agentAccess.voice:home.agentAccess.business||a.key==='business-doctor').map(a=>({id:a.key,href:a.href,icon:a.icon,department:a.department,name:label(a.labelFa,a.labelEn,a.labelDe),description:label(a.descriptionFa,a.descriptionEn,a.descriptionDe)}));
 if(home.agentAccess.student)general.push({id:'student',href:'/student',icon:'GraduationCap',department:'strategy',name:label('دستیار دانشجویی','Student assistant'),description:label('درس‌ها و برنامه مطالعه','Courses and study planning')});
 return NextResponse.json({general,industry:industry.filter(m=>access[m.key]&&m.href).map(m=>({id:m.key,href:m.href,name:label(m.labelFa,m.labelEn,m.labelDe),description:label(m.descriptionFa??'',m.descriptionEn??'',m.descriptionDe)}))});
}
