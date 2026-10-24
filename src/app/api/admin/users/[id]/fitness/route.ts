export const dynamic="force-dynamic";
import {NextRequest,NextResponse} from "next/server";
import {requireAdmin,unauthorizedResponse} from "@/lib/auth/middleware";
import {prisma} from "@/lib/db/prisma";
import {z} from "zod";
export async function GET(req:NextRequest, props:{params: Promise<{id:string}>}) {
  const params = await props.params;
  if(!(await requireAdmin(req)))return unauthorizedResponse(req);const user=await prisma.user.findUniqueOrThrow({where:{id:params.id},select:{fitnessAccessExpiry:true,fitnessProfile:{select:{entitlementExpiry:true}}}});return NextResponse.json(user);
}
export async function PUT(req:NextRequest, props:{params: Promise<{id:string}>}) {
  const params = await props.params;
  const a=await requireAdmin(req);if(!a)return unauthorizedResponse(req);try{const b=z.object({enabled:z.boolean(),days:z.number().int().min(1).max(366),reason:z.string().min(5).max(1000)}).strict().parse(await req.json());await prisma.$transaction(async tx=>{const before=await tx.user.findUniqueOrThrow({where:{id:params.id},select:{fitnessAccessExpiry:true}});const expiry=b.enabled?new Date(Date.now()+b.days*86400000):null;await tx.user.update({where:{id:params.id},data:{fitnessAccessExpiry:expiry}});if(!b.enabled)await tx.fitnessProfile.updateMany({where:{userId:params.id},data:{entitlementExpiry:null}});await tx.auditLog.create({data:{actorId:a.id,action:"fitness_admin_access_changed",targetId:params.id,metadata:JSON.stringify({before,expiry,reason:b.reason})}});});return NextResponse.json({ok:true});}catch{return NextResponse.json({error:"INVALID_FITNESS_ACCESS"},{status:400});}
}
