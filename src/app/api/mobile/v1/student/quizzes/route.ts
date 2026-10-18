import {NextRequest,NextResponse} from 'next/server';
import {requireAuth,unauthorizedResponse} from '@/lib/auth/middleware';
import {studentWorkspaceDisabledResponse} from '@/lib/student/access';
import {prisma} from '@/lib/db/prisma';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 const user=await requireAuth(req);if(!user)return unauthorizedResponse(req);
 const denied=await studentWorkspaceDisabledResponse(user);if(denied)return denied;
 const courseId=req.nextUrl.searchParams.get('courseId');if(!courseId)return NextResponse.json({error:'Course required'},{status:400});
 const quizzes=await prisma.studentQuiz.findMany({where:{courseId,course:{userId:user.id}},take:50,orderBy:{createdAt:'desc'},select:{id:true,title:true,timeLimitSeconds:true,attempts:{where:{userId:user.id},take:5,orderBy:{completedAt:'desc'},select:{id:true,score:true,total:true,completedAt:true}}}});
 return NextResponse.json({quizzes},{headers:{'Cache-Control':'no-store'}});
}
