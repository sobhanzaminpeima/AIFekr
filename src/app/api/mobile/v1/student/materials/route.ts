import {createHash} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {requireAuth,unauthorizedResponse} from '@/lib/auth/middleware';
import {prisma} from '@/lib/db/prisma';
import {POST as uploadMaterial} from '@/app/api/student/materials/route';
import {studentWorkspaceDisabledResponse} from '@/lib/student/access';
export const dynamic='force-dynamic';
export async function POST(req:NextRequest){
 if(process.env.MOBILE_API_ENABLED!=='true')return NextResponse.json({error:'Mobile API disabled'},{status:503});
 const user=await requireAuth(req);if(!user)return unauthorizedResponse(req);
 const unavailable=await studentWorkspaceDisabledResponse(user);if(unavailable)return unavailable;
 if(Number(req.headers.get('content-length')||0)>11*1024*1024)return NextResponse.json({error:'File exceeds 10 MB'},{status:413});
 let form:FormData;try{form=await req.formData();}catch{return NextResponse.json({error:'Invalid upload'},{status:400});}
 const file=form.get('file'),courseId=form.get('courseId'),key=form.get('requestKey');
 const content=form.get('content'),title=form.get('title'),source=form.get('source');
 const textMode=!(file instanceof File)&&typeof content==='string'&&content.trim().length>0&&content.length<=100000&&typeof title==='string'&&title.trim().length>0&&title.length<=200&&['text','image_ocr'].includes(String(source));
 if((!(file instanceof File)&&!textMode)||typeof courseId!=='string'||typeof key!=='string'||!/^material_[a-zA-Z0-9_-]{8,100}$/.test(key))return NextResponse.json({error:'Invalid upload fields'},{status:400});
 if(file instanceof File&&(!file.size||file.size>10*1024*1024))return NextResponse.json({error:'File must be between 1 byte and 10 MB'},{status:413});
 if(!await prisma.studentCourse.findFirst({where:{id:courseId,userId:user.id},select:{id:true}}))return NextResponse.json({error:'Course not found'},{status:404});
 const inputHash=file instanceof File?createHash('sha256').update(JSON.stringify({courseId,name:file.name,type:file.type})).update(Buffer.from(await file.arrayBuffer())).digest('hex'):createHash('sha256').update(JSON.stringify({courseId,title,content,source})).digest('hex');
 const existing=await prisma.mobileRequest.findUnique({where:{userId_requestKey:{userId:user.id,requestKey:key}}});
 if(existing){if(existing.inputHash!==inputHash)return NextResponse.json({error:'Request key already used'},{status:409});if(existing.status==='COMPLETED')return NextResponse.json(JSON.parse(existing.responseJson||'{}'),{headers:{'Cache-Control':'no-store'}});return NextResponse.json({error:'Upload already submitted. Inspect materials before retrying.',status:existing.status},{status:409});}
 let id:string;try{id=(await prisma.mobileRequest.create({data:{userId:user.id,requestKey:key,inputHash,status:'RUNNING'}})).id;}catch{return NextResponse.json({error:'Upload already submitted'},{status:409});}
 try{
  const forwarded=new FormData();forwarded.set('courseId',courseId);if(file instanceof File)forwarded.set('file',file);else {forwarded.set('content',String(content));forwarded.set('title',String(title));forwarded.set('source',String(source));}
  const headers=new Headers(req.headers);headers.delete('content-type');headers.delete('content-length');
  const response=await uploadMaterial(new NextRequest(req.url,{method:'POST',headers,body:forwarded}));
  const result=await response.json();
  await prisma.mobileRequest.update({where:{id},data:{status:response.ok?'COMPLETED':'FAILED',responseJson:response.ok?JSON.stringify(result):null}});
  return NextResponse.json(result,{status:response.status,headers:{'Cache-Control':'no-store'}});
 }catch{
  await prisma.mobileRequest.updateMany({where:{id,status:'RUNNING'},data:{status:'UNKNOWN'}});
  return NextResponse.json({error:'Upload outcome uncertain. Inspect materials before retrying.'},{status:503});
 }
}
