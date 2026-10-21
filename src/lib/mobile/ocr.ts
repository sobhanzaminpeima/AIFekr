import {createHash} from 'node:crypto';
import {prisma} from '@/lib/db/prisma';
import {PROVIDERS} from '@/lib/ai/providers';
import {getCreditCosts} from '@/lib/utils/creditCosts';
import {toolCostKey} from '@/lib/utils/credits';
import {reserveLoggedCredits,refundLoggedReservation} from '@/lib/utils/teamCredits';
import {extractPptxImages,ocrImages} from '@/lib/student/ocr';
import {extractPdfImages} from '@/lib/student/pdfImages';
export async function ocrQuote(){const costs=await getCreditCosts();return {credits:costs[toolCostKey('student.ocr')]??costs.tool,available:PROVIDERS.some(p=>['gemini','openai-direct'].includes(p.id)&&p.apiKey.length>10),maxBytes:10*1024*1024};}
export async function mobileOcr(userId:string,file:File,key:string,acceptedCredits:number,language:string){
 const isPdf=file.type==='application/pdf'||file.name.toLowerCase().endsWith('.pdf'),isPptx=file.type==='application/vnd.openxmlformats-officedocument.presentationml.presentation'||file.name.toLowerCase().endsWith('.pptx');
 if(!file.size||file.size>10*1024*1024||!isPdf&&!isPptx&&!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type))return {status:415,body:{error:'Unsupported file or size'}};
 const bytes=Buffer.from(await file.arrayBuffer()),hash=createHash('sha256').update(bytes).update(file.type).update(language).digest('hex');
 const prior=await prisma.mobileRequest.findUnique({where:{userId_requestKey:{userId,requestKey:key}}});if(prior){if(prior.inputHash!==hash)return {status:409,body:{error:'Request key already used'}};return prior.status==='COMPLETED'&&prior.responseJson?{status:200,body:JSON.parse(prior.responseJson)}:{status:409,body:{error:'Already submitted; inspect request status',status:prior.status}};}
 const quote=await ocrQuote();if(!quote.available)return {status:503,body:{error:'Vision provider not configured'}};if(acceptedCredits<quote.credits)return {status:409,body:{error:'Cost changed; review estimate'}};
 let admitted;try{admitted=await prisma.$transaction(async tx=>{const job=await tx.mobileRequest.create({data:{userId,requestKey:key,inputHash:hash,status:'RUNNING'}});const reservation=await reserveLoggedCredits(tx,userId,quote.credits,{type:'tool',requestId:job.id,metadata:{feature:'student.ocr',status:'RESERVED'}});if(!reservation)throw Error('INSUFFICIENT_CREDITS');await tx.mobileRequest.update({where:{id:job.id},data:{responseJson:JSON.stringify({reservation,credits:quote.credits})}});return {job,reservation};});}catch(e){return {status:e instanceof Error&&e.message==='INSUFFICIENT_CREDITS'?402:409,body:{error:'Insufficient credits or request already admitted'}};}
 let text:string;let imageCount:number;
 try{const images=isPdf?await extractPdfImages(bytes):isPptx?await extractPptxImages(bytes):[{name:file.name,mimeType:file.type,data:bytes}];if(!images.length)throw Error('NO_IMAGES');imageCount=images.length;text=await ocrImages(images,language);if(!text?.trim()||text.length>100000)throw Error('INVALID_TEXT');}catch{await prisma.$transaction(async tx=>{const claimed=await tx.mobileRequest.updateMany({where:{id:admitted.job.id,status:'RUNNING'},data:{status:'REFUNDED'}});if(claimed.count)await refundLoggedReservation(tx,{...admitted.reservation,userId,credits:quote.credits},{feature:'student.ocr',status:'REFUNDED'},'tool');});return {status:502,body:{error:'OCR failed; reserved credits refunded',status:'REFUNDED'}};}
 const result={text:text.trim(),imageCount,creditsUsed:quote.credits};await prisma.$transaction(async tx=>{await tx.mobileRequest.update({where:{id:admitted.job.id},data:{status:'COMPLETED',responseJson:JSON.stringify(result)}});await tx.usageLog.update({where:{id:admitted.reservation.usageLogId},data:{metadata:JSON.stringify({feature:'student.ocr',status:'COMPLETED'})}});});return {status:200,body:result};
}
