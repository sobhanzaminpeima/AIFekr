export const dynamic="force-dynamic";
import {NextRequest,NextResponse} from "next/server";
import {isCronAuthorized} from "@/lib/auth/cronAuth";
import {releaseAbandonedMarketOrders} from "@/lib/fitness/marketplace";
export async function GET(req:NextRequest){if(!isCronAuthorized(req))return new NextResponse(null,{status:401});return NextResponse.json({released:await releaseAbandonedMarketOrders()});}
