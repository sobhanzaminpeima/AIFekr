import {NextRequest,NextResponse} from "next/server";
import {requireAdmin,forbiddenResponse} from "@/lib/auth/middleware";
import {approveBlueprint,failCourseJob} from "@/lib/courses/generation";
import {prisma} from "@/lib/db/prisma";
import {courseError} from "@/lib/courses/http";
export async function POST(req:NextRequest,{params}:{params:{id:string}}){const admin=await requireAdmin(req);if(!admin)return forbiddenResponse();const body=await req.json().catch(()=>null);if(!body||body.confirm!==true)return NextResponse.json({error:"CONFIRMATION_REQUIRED"},{status:400});try{if(body.cancel===true){const course=await prisma.aiCourse.findUniqueOrThrow({where:{id:params.id}});if(course.activeJobId)await failCourseJob(course.activeJobId,"CANCELLED_BY_ADMIN");return NextResponse.json({cancelled:true});}return NextResponse.json({job:await approveBlueprint(admin.id,params.id,body.blueprint)});}catch(error){return courseError(error);}}
