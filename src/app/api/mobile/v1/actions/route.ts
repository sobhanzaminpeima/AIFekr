import {NextRequest,NextResponse} from "next/server";
import {requireAuth,unauthorizedResponse} from "@/lib/auth/middleware";
import {accessibleMobileActions} from "@/lib/mobile/actions";
import {getServerLang} from "@/lib/i18n/server";
export const dynamic="force-dynamic";
export async function GET(req:NextRequest){const user=await requireAuth(req);if(!user)return unauthorizedResponse(req);return NextResponse.json({actions:await accessibleMobileActions(user,await getServerLang())},{headers:{'Cache-Control':'no-store'}});}
