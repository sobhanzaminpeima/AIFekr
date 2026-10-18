import {createHash} from 'node:crypto';
import {prisma} from '@/lib/db/prisma';
import type {Prisma} from '@prisma/client';
const enabled=()=>process.env.MOBILE_API_ENABLED==='true'&&process.env.MOBILE_PUSH_ENABLED==='true';
export async function enqueueMobilePush(notification:{id:string;userId:string;createdAt:Date},db:Prisma.TransactionClient=prisma){
 if(!enabled())return;
 const sessions=await db.mobileSession.findMany({where:{userId:notification.userId,user:{isBlocked:false},revokedAt:null,expiresAt:{gt:new Date()},pushToken:{not:null},pushEnabledAt:{lte:notification.createdAt}},select:{id:true}});
 for(const session of sessions){const key=`push_${notification.id}_${session.id}`;await db.mobileRequest.upsert({where:{userId_requestKey:{userId:notification.userId,requestKey:key}},create:{userId:notification.userId,requestKey:key,inputHash:createHash('sha256').update(key).digest('hex'),status:'PUSH_QUEUED',responseJson:JSON.stringify({kind:'push',sessionId:session.id,notificationId:notification.id})},update:{}});}
}
const post=async(path:string,body:unknown)=>{
 const response=await fetch('https://exp.host/--/api/v2/push/'+path,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json',...(process.env.EXPO_PUSH_ACCESS_TOKEN?{Authorization:`Bearer ${process.env.EXPO_PUSH_ACCESS_TOKEN}`}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new Error('Push service unavailable');return response.json();
};
export async function dispatchMobilePush(){
 if(!enabled())return {processed:0};
 await prisma.mobileRequest.updateMany({where:{status:'PUSH_SENDING',updatedAt:{lt:new Date(Date.now()-5*60000)},requestKey:{startsWith:'push_'}},data:{status:'UNKNOWN'}});
 await prisma.mobileRequest.updateMany({where:{status:'PUSH_TICKET',updatedAt:{lt:new Date(Date.now()-24*3600000)},requestKey:{startsWith:'push_'}},data:{status:'UNKNOWN'}});
 const [queued,tickets]=await Promise.all([
  prisma.mobileRequest.findMany({where:{status:'PUSH_QUEUED',requestKey:{startsWith:'push_'}},orderBy:{createdAt:'asc'},take:25}),
  prisma.mobileRequest.findMany({where:{status:'PUSH_TICKET',updatedAt:{lte:new Date(Date.now()-15*60000)},requestKey:{startsWith:'push_'}},orderBy:{updatedAt:'asc'},take:25})
 ]);
 const jobs=[...queued,...tickets];
 let processed=0;
 for(const job of jobs){
  let payload:{sessionId:string;notificationId:string;ticket?:string};try{payload=JSON.parse(job.responseJson||'');}catch{await prisma.mobileRequest.update({where:{id:job.id},data:{status:'FAILED'}});continue;}
  const session=await prisma.mobileSession.findFirst({where:{id:payload.sessionId,userId:job.userId,user:{isBlocked:false},revokedAt:null,expiresAt:{gt:new Date()},pushToken:{not:null}}});
  if(!session){await prisma.mobileRequest.update({where:{id:job.id},data:{status:'PUSH_CANCELLED'}});continue;}
  // An uncertain send is never automatically repeated: Expo is at-least-once.
  if(job.status==='PUSH_TICKET'){
   if(!payload.ticket||job.updatedAt.getTime()>Date.now()-15*60000)continue;
   try{const response=await post('getReceipts',{ids:[payload.ticket]});const receipt=response.data?.[payload.ticket];if(!receipt)continue;
    if(receipt.details?.error==='DeviceNotRegistered')await prisma.mobileSession.updateMany({where:{id:session.id,pushToken:session.pushToken},data:{pushToken:null,pushEnabledAt:null}});
    await prisma.mobileRequest.updateMany({where:{id:job.id,status:'PUSH_TICKET'},data:{status:receipt.status==='ok'?'PUSH_RECEIPT_OK':'FAILED'}});processed++;
   }catch{/* Read-only receipt lookup can be repeated on the next cron. */}continue;
  }
  const notification=await prisma.notification.findFirst({where:{id:payload.notificationId,userId:job.userId}});
  if(!notification||!session.pushEnabledAt||notification.createdAt<session.pushEnabledAt){await prisma.mobileRequest.update({where:{id:job.id},data:{status:'PUSH_CANCELLED'}});continue;}
  if(!(await prisma.mobileRequest.updateMany({where:{id:job.id,status:'PUSH_QUEUED'},data:{status:'PUSH_SENDING'}})).count)continue;
  try{
   // Lock-screen payload deliberately excludes customer, financial and health text.
   const response=await post('send',{to:session.pushToken,title:'AIFekr',body:'You have a new notification.',channelId:'aifekr',data:{notificationId:notification.id,target:'notifications'},ttl:3600});
   const ticket=Array.isArray(response.data)?response.data[0]:response.data;
   if(ticket?.status==='ok'&&typeof ticket.id==='string')await prisma.mobileRequest.update({where:{id:job.id},data:{status:'PUSH_TICKET',responseJson:JSON.stringify({...payload,kind:'push',ticket:ticket.id})}});
   else{if(ticket?.details?.error==='DeviceNotRegistered')await prisma.mobileSession.updateMany({where:{id:session.id,pushToken:session.pushToken},data:{pushToken:null,pushEnabledAt:null}});await prisma.mobileRequest.update({where:{id:job.id},data:{status:'FAILED'}});}
  }catch{await prisma.mobileRequest.updateMany({where:{id:job.id,status:'PUSH_SENDING'},data:{status:'UNKNOWN'}});}processed++;
 }
 return {processed};
}
