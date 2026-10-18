import { NextRequest,NextResponse } from "next/server";
import {requireAuth,unauthorizedResponse} from "@/lib/auth/middleware";
import {mobileChatQuote} from "@/lib/ai/mobileChatQuote";
export const dynamic="force-dynamic";
export async function GET(req:NextRequest){const user=await requireAuth(req);if(!user)return unauthorizedResponse(req);return NextResponse.json(await mobileChatQuote(),{headers:{"Cache-Control":"no-store"}});}
