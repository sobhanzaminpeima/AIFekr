import {createHash} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {requireAuth,unauthorizedResponse} from '@/lib/auth/middleware';
import {prisma} from '@/lib/db/prisma';
import {POST as upload} from '@/app/api/upload/route';
import {rateLimit} from '@/lib/utils/rateLimit';
export const dynamic='force-dynamic';
export async function POST(req:NextRequest){
 if(process.env.MOBILE_API_ENABLED!=='true')return NextResponse.json({error:'Mobile API disabled'},{status:503});
 const user=await requireAuth(req);if(!user)return unauthorizedResponse(req);
 if(!rateLimit(`native-reference:${user.id}`,5,60000).allowed)return NextResponse.json({error:'Too many requests'},{status:429});
 if(Number(req.headers.get('content-length')||0)>9*1024*1024)return NextResponse.json({error:'Image too large'},{status:413});
 let form:FormData;try{form=await req.formData();}catch{return NextResponse.json({error:'Invalid upload'},{status:400});}
 const file=form.get('file'),key=form.get('requestKey');if(!(file instanceof File)||!file.size||file.size>8*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type)||typeof key!=='string'||!/^reference_[a-zA-Z0-9_-]{8,100}$/.test(key))return NextResponse.json({error:'Invalid reference image'},{status:400});
 const hash=createHash('sha256').update(Buffer.from(await file.arrayBuffer())).update(file.type).digest('hex');
 const previous=await prisma.mobileRequest.findUnique({where:{userId_requestKey:{userId:user.id,requestKey:key}}});if(previous)return previous.inputHash===hash&&previous.status==='COMPLETED'&&previous.responseJson?NextResponse.json(JSON.parse(previous.responseJson),{headers:{'Cache-Control':'no-store'}}):NextResponse.json({error:'Already submitted or input changed'},{status:409});
 let id:string;try{id=(await prisma.mobileRequest.create({data:{userId:user.id,requestKey:key,inputHash:hash,status:'RUNNING'}})).id;}catch{return NextResponse.json({error:'Already submitted'},{status:409});}
 try{const forwarded=new FormData();forwarded.set('file',file);const headers=new Headers(req.headers);headers.delete('content-type');headers.delete('content-length');const response=await upload(new NextRequest(req.url,{method:'POST',headers,body:forwarded}));const data=await response.json();if(!response.ok){await prisma.mobileRequest.update({where:{id},data:{status:'FAILED'}});return NextResponse.json(data,{status:response.status});}const url=new URL(data.url);if(url.protocol!=='https:'||url.username||url.password)throw Error('Invalid storage URL');const result={kind:'reference',url:url.href,requestKey:key};await prisma.mobileRequest.update({where:{id},data:{status:'COMPLETED',responseJson:JSON.stringify(result)}});return NextResponse.json(result,{headers:{'Cache-Control':'no-store'}});}catch{await prisma.mobileRequest.updateMany({where:{id,status:'RUNNING'},data:{status:'UNKNOWN'}});return NextResponse.json({error:'Upload outcome uncertain; inspect status before another upload'},{status:503});}
}

