import {NextRequest,NextResponse} from "next/server";
import {requireAuth,unauthorizedResponse} from "@/lib/auth/middleware";
import {prisma} from "@/lib/db/prisma";
export const dynamic="force-dynamic";
export async function GET(req:NextRequest){const user=await requireAuth(req);if(!user)return unauthorizedResponse(req);const conversations=await prisma.conversation.findMany({where:{userId:user.id},select:{id:true,title:true,updatedAt:true},orderBy:{updatedAt:"desc"},take:50});return NextResponse.json({conversations},{headers:{"Cache-Control":"no-store"}});}
