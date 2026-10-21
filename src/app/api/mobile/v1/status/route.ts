import {NextResponse} from 'next/server';
export const dynamic='force-dynamic';
export function GET(){const enabled=process.env.MOBILE_API_ENABLED==='true';return NextResponse.json({service:'aifekr-mobile',apiVersion:1,enabled},{status:enabled?200:503,headers:{'Cache-Control':'no-store'}});}
