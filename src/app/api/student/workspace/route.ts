export const dynamic="force-dynamic";
import {NextRequest,NextResponse} from 'next/server';
import {requireAuth,unauthorizedResponse} from '@/lib/auth/middleware';
import {studentWorkspaceDisabledResponse} from '@/lib/student/access';
import {prisma} from '@/lib/db/prisma';
import {getEnabledProviders} from '@/lib/ai/router';
import {STUDENT_AI_MINIMUM_BALANCE} from '@/lib/student/mobileAiContract';
export async function GET(req:NextRequest){
 const user=await requireAuth(req);if(!user)return unauthorizedResponse(req);
 const denied=await studentWorkspaceDisabledResponse(user);if(denied)return denied;
 const quizzes=await prisma.studentQuiz.findMany({where:{course:{userId:user.id}},select:{id:true,courseId:true,title:true,timeLimitSeconds:true,createdAt:true,attempts:{where:{userId:user.id},select:{id:true,score:true,total:true,completedAt:true}}},orderBy:{createdAt:'desc'},take:100});
 const costs=getEnabledProviders().map(p=>p.creditCost).filter(n=>Number.isFinite(n)&&n>=0);
 return NextResponse.json({quizzes,ai:{minimumBalance:STUDENT_AI_MINIMUM_BALANCE,minimumCredits:costs.length?Math.min(...costs):null,maximumCredits:costs.length?Math.max(...costs):null}});
}
