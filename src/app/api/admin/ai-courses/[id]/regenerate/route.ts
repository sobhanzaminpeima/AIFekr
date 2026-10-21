import {NextRequest,NextResponse} from "next/server";
import {requireAdmin,forbiddenResponse} from "@/lib/auth/middleware";
import {fragmentActions,fragmentFeature,fragmentRequest,queueFragment,applyFragment} from "@/lib/courses/regeneration";
import {getCreditCosts} from "@/lib/utils/creditCosts";
import {toolCostKey} from "@/lib/utils/credits";
import {courseError} from "@/lib/courses/http";
import {prisma} from "@/lib/db/prisma";
import {z} from "zod";
export const dynamic="force-dynamic";
export async function GET(req:NextRequest,{params}:{params:{id:string}}){const admin=await requireAdmin(req);if(!admin)return forbiddenResponse();const costs=await getCreditCosts();const jobs=await prisma.aiCourseGenerationJob.findMany({where:{courseId:params.id,phase:"FRAGMENT"},orderBy:{createdAt:"desc"},take:10,select:{id:true,status:true,checkpoint:true,credits:true,userId:true,idempotencyKey:true}});return NextResponse.json({actorId:admin.id,costs:Object.fromEntries(fragmentActions.map(a=>[a,costs[toolCostKey(fragmentFeature(a))]])),jobs});}
export async function POST(req:NextRequest,{params}:{params:{id:string}}){const admin=await requireAdmin(req);if(!admin)return forbiddenResponse();const parsed=fragmentRequest.safeParse(await req.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:"INVALID_REQUEST"},{status:400});try{return NextResponse.json({job:await queueFragment(admin.id,params.id,parsed.data)},{status:202});}catch(error){return courseError(error);}}
export async function PATCH(req:NextRequest,{params}:{params:{id:string}}){const admin=await requireAdmin(req);if(!admin)return forbiddenResponse();const parsed=z.object({jobId:z.string().uuid(),confirm:z.literal(true)}).strict().safeParse(await req.json().catch(()=>null));if(!parsed.success)return NextResponse.json({error:"CONFIRMATION_REQUIRED"},{status:400});try{return NextResponse.json(await applyFragment(admin.id,params.id,parsed.data.jobId));}catch(error){return courseError(error);}}
