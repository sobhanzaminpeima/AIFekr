import {NextRequest,NextResponse} from 'next/server';
import {requireAuth,unauthorizedResponse} from '@/lib/auth/middleware';
import {studentWorkspaceDisabledResponse} from '@/lib/student/access';
import {getServerLang} from '@/lib/i18n/server';
import {rateLimit} from '@/lib/utils/rateLimit';
import {mobileOcr,ocrQuote} from '@/lib/mobile/ocr';
export const dynamic='force-dynamic';
async function auth(req:NextRequest){if(process.env.MOBILE_API_ENABLED!=='true')return {error:NextResponse.json({error:'Mobile API disabled'},{status:503})};const user=await requireAuth(req);if(!user)return {error:unauthorizedResponse(req)};const denied=await studentWorkspaceDisabledResponse(user);return denied?{error:denied}:{user};}
export async function GET(req:NextRequest){const identity=await auth(req);if(identity.error)return identity.error;return NextResponse.json(await ocrQuote(),{headers:{'Cache-Control':'no-store'}});}
export async function POST(req:NextRequest){const identity=await auth(req);if(identity.error)return identity.error;const user=identity.user!;if(!rateLimit(`native-ocr:${user.id}`,8,60000).allowed)return NextResponse.json({error:'Too many requests'},{status:429});if(Number(req.headers.get('content-length')||0)>11*1024*1024)return NextResponse.json({error:'File too large'},{status:413});let form:FormData;try{form=await req.formData();}catch{return NextResponse.json({error:'Invalid upload'},{status:400});}const file=form.get('file'),key=form.get('requestKey'),rawAccepted=form.get('acceptedCredits'),accepted=typeof rawAccepted==='string'&&rawAccepted.trim()?Number(rawAccepted):NaN;if(!(file instanceof File)||typeof key!=='string'||!/^student_ocr_[a-zA-Z0-9_-]{8,100}$/.test(key)||!Number.isInteger(accepted)||accepted<0)return NextResponse.json({error:'Invalid upload'},{status:400});try{const result=await mobileOcr(user.id,file,key,accepted,await getServerLang());return NextResponse.json(result.body,{status:result.status,headers:{'Cache-Control':'no-store'}});}catch{return NextResponse.json({error:'OCR outcome uncertain; check request status before resubmitting'},{status:503});}}

