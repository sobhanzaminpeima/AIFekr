import {NextRequest,NextResponse} from 'next/server';
import {GET as requestStatus} from '@/app/api/mobile/v1/requests/[key]/route';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest,context:{params:{key:string}}){
 if(process.env.MOBILE_API_ENABLED!=='true')return NextResponse.json({error:'Mobile API disabled'},{status:503});
 if(!/^fit_(coach|diary)_[a-zA-Z0-9_-]{8,100}$/.test(context.params.key))return NextResponse.json({error:'Not found'},{status:404});
 return requestStatus(req,context);
}
