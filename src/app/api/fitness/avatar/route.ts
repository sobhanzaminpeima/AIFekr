import {NextRequest,NextResponse} from 'next/server';
import {requireAuth,unauthorizedResponse} from '@/lib/auth/middleware';
import {prisma} from '@/lib/db/prisma';
import sharp from 'sharp';
export async function POST(req:NextRequest){
 const user=await requireAuth(req);if(!user)return unauthorizedResponse(req);
 if(Number(req.headers.get('content-length'))>6*1024*1024)return new NextResponse(null,{status:413});
 try{const file=(await req.formData()).get('file');if(!(file instanceof File)||file.size>5*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type))return NextResponse.json({error:'INVALID_IMAGE_MAX_5MB'},{status:400});
 const bytes=await sharp(Buffer.from(await file.arrayBuffer()),{limitInputPixels:25000000}).rotate().resize(512,512,{fit:'cover'}).webp({quality:80}).toBuffer();if(bytes.length>256*1024)throw Error();
 const avatar='data:image/webp;base64,'+bytes.toString('base64');await prisma.user.update({where:{id:user.id},data:{avatar}});return NextResponse.json({avatar});
 }catch{return NextResponse.json({error:'INVALID_IMAGE'},{status:400});}
}
