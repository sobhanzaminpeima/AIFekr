export const dynamic="force-dynamic";
import {NextRequest,NextResponse} from "next/server";
import {requireAuth,unauthorizedResponse} from "@/lib/auth/middleware";
import {studentWorkspaceDisabledResponse} from "@/lib/student/access";
import {prisma} from "@/lib/db/prisma";
import {legacyCertificate} from "@/lib/courses/legacyCertificate";
import {certificatePdf} from "@/lib/courses/certificatePdf";
export async function GET(req:NextRequest,{params}:{params:{id:string}}){
 const user=await requireAuth(req);if(!user)return unauthorizedResponse(req);const denied=await studentWorkspaceDisabledResponse(user);if(denied)return denied;
 const admin=user.role==="ADMIN"||user.role==="SUPER_ADMIN";
 const certificateId=req.nextUrl.searchParams.get("certificate");
 const c=await prisma.aiCourseCertificate.findFirst({where:{...(certificateId?{id:certificateId}:{}),completion:{courseId:params.id,...(admin&&certificateId?{}:{userId:user.id})}},orderBy:{issuedAt:"desc"}});
 if(!c&&!certificateId){const legacy=await legacyCertificate(user,params.id);if(legacy)return legacy;}
 if(!c)return NextResponse.json({error:"CERTIFICATE_NOT_EARNED"},{status:404});if(c.status!=="ACTIVE")return NextResponse.json({error:"CERTIFICATE_REVOKED"},{status:410});
 if(req.nextUrl.searchParams.get("format")==="json")return NextResponse.json({certificate:c});
 let buffer:Buffer;
 try{buffer=await certificatePdf(c);}catch(error){console.error("Academy certificate rendering failed",error instanceof Error?error.message:"unknown");return NextResponse.json({error:"CERTIFICATE_RENDER_FAILED"},{status:503});}
 await prisma.auditLog.create({data:{actorId:user.id,action:"academy_certificate_downloaded",targetId:c.id}});
 return new NextResponse(new Uint8Array(buffer),{headers:{"Content-Type":"application/pdf","Content-Disposition":'attachment; filename="AIFekr-course-certificate.pdf"',"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
}
