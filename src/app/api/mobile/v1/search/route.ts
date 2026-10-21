import {NextRequest,NextResponse} from 'next/server';
import {prisma} from '@/lib/db/prisma';
import {requireAuth,unauthorizedResponse} from '@/lib/auth/middleware';
import {resolveCrmWorkspace,agentFilter,businessFilter} from '@/lib/crm/workspace';
import {resolveOrganizationContext,hasOrganizationPermission} from '@/lib/organization/context';
import {studentWorkspaceDisabledResponse} from '@/lib/student/access';
import {rateLimit} from '@/lib/utils/rateLimit';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 if(process.env.MOBILE_API_ENABLED!=='true')return NextResponse.json({error:'Mobile API disabled'},{status:503});
 const user=await requireAuth(req);if(!user)return unauthorizedResponse(req);
 const q=(req.nextUrl.searchParams.get('q')||'').trim();
 if(q.length<2||q.length>100)return NextResponse.json({error:'Search requires 2–100 characters'},{status:400});
 if(!rateLimit('mobile-search:'+user.id,30,60000).allowed)return NextResponse.json({error:'Rate limit'},{status:429});
 const results:{id:string;kind:string;title:string}[]=[];
 const conversations=await prisma.conversation.findMany({where:{userId:user.id,title:{contains:q}},select:{id:true,title:true},orderBy:{updatedAt:'desc'},take:16});
 results.push(...conversations.slice(0,15).map(row=>({id:row.id,kind:'conversation',title:row.title||''})));
 const org=await resolveOrganizationContext(user.id);let contactCount=0;
 if(user.accountType!=='STUDENT'&&(!org||hasOrganizationPermission(org,'crm.view'))){
  const ws=await resolveCrmWorkspace(user.id);
  const contacts=await prisma.crmContact.findMany({where:{userId:ws.workspaceUserId,...businessFilter(ws),...agentFilter(ws),OR:[{name:{contains:q}},{email:{contains:q}},{phone:{contains:q}}]},select:{id:true,name:true},orderBy:{updatedAt:'desc'},take:16});
  contactCount=contacts.length;results.push(...contacts.slice(0,15).map(row=>({id:row.id,kind:'contact',title:row.name})));
 }
 let courseCount=0,materialCount=0;
 if(!await studentWorkspaceDisabledResponse(user)){
  const courses=await prisma.studentCourse.findMany({where:{userId:user.id,name:{contains:q}},select:{id:true,name:true},take:16});
  const materials=await prisma.studentMaterial.findMany({where:{userId:user.id,course:{userId:user.id},title:{contains:q}},select:{id:true,title:true},take:16});
  courseCount=courses.length;materialCount=materials.length;
  results.push(...courses.slice(0,15).map(row=>({id:row.id,kind:'course',title:row.name})),...materials.slice(0,15).map(row=>({id:row.id,kind:'material',title:row.title})));
 }
 return NextResponse.json({results,truncated:[conversations.length,contactCount,courseCount,materialCount].some(n=>n>15),scope:'titles-and-contact-identifiers'},{headers:{'Cache-Control':'no-store'}});
}
