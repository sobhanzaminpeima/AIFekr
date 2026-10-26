require('@next/env').loadEnvConfig(process.cwd());
const {S3Client,PutObjectCommand,GetObjectCommand,DeleteObjectCommand}=require('@aws-sdk/client-s3');
const {getSignedUrl}=require('@aws-sdk/s3-request-presigner');
const {randomUUID}=require('node:crypto');
(async()=>{
 const bucket=process.env.VOICE_STUDIO_R2_BUCKET||process.env.R2_BUCKET_NAME;
 if(!bucket||!process.env.R2_ACCESS_KEY_ID){console.log({configured:false});return;}
 const client=new S3Client({region:'auto',endpoint:`https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,credentials:{accessKeyId:process.env.R2_ACCESS_KEY_ID,secretAccessKey:process.env.R2_SECRET_ACCESS_KEY}});
 const key=`voice-studio/readiness/${randomUUID()}.txt`;
 try{
  await client.send(new PutObjectCommand({Bucket:bucket,Key:key,Body:'AIFekr private storage readiness',ContentType:'text/plain'}));
  const signed=await getSignedUrl(client,new GetObjectCommand({Bucket:bucket,Key:key}),{expiresIn:60});
  const authenticated=await fetch(signed,{signal:AbortSignal.timeout(15000)});
  await authenticated.body?.cancel();
  let publicStatus=null;
  if(process.env.R2_PUBLIC_URL&&!process.env.VOICE_STUDIO_R2_BUCKET){const response=await fetch(process.env.R2_PUBLIC_URL.replace(/\/$/,'')+'/'+key,{signal:AbortSignal.timeout(15000)});publicStatus=response.status;await response.body?.cancel();}
  console.log({configured:true,signedRead:authenticated.status,publicRead:publicStatus,isolatedBucket:!!process.env.VOICE_STUDIO_R2_BUCKET});
 }catch{console.log({error:'STORAGE_PROBE_FAILED'});}finally{await client.send(new DeleteObjectCommand({Bucket:bucket,Key:key})).catch(()=>console.log({cleanup:'RETRY_REQUIRED'}));}
})();
