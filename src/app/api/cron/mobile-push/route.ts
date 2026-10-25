import {NextRequest,NextResponse} from 'next/server';
import {isCronAuthorized} from '@/lib/auth/cronAuth';
import {dispatchMobilePush} from '@/lib/mobile/push';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest){if(!isCronAuthorized(req))return NextResponse.json({error:'Unauthorized'},{status:401});return NextResponse.json(await dispatchMobilePush());}
