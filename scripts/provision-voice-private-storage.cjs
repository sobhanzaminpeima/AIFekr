require('@next/env').loadEnvConfig(process.cwd());
const {S3Client,CreateBucketCommand,PutObjectCommand,GetObjectCommand,DeleteObjectCommand}=require('@aws-sdk/client-s3');
const {getSignedUrl}=require('@aws-sdk/s3-request-presigner');
const {randomUUID}=require('node:crypto');
const fs=require('node:fs');
(async()=>{
 const bucket='aifekr-private-media-20261026',endpoint=`https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
 const client=new S3Client({region:'auto',endpoint,credentials:{accessKeyId:process.env.R2_ACCESS_KEY_ID,secretAccessKey:process.env.R2_SECRET_ACCESS_KEY}});
 const key=`voice-studio/readiness/${randomUUID()}.txt`;let uploaded=false;
 try{
  await client.send(new CreateBucketCommand({Bucket:bucket})).catch(error=>{if(error.name!=='BucketAlreadyOwnedByYou')throw error;});
  await client.send(new PutObjectCommand({Bucket:bucket,Key:key,Body:'AIFekr private storage readiness',ContentType:'text/plain'}));uploaded=true;
  const signed=await getSignedUrl(client,new GetObjectCommand({Bucket:bucket,Key:key}),{expiresIn:60});
  const authenticated=await fetch(signed,{signal:AbortSignal.timeout(15000)});await authenticated.body?.cancel();
  const unsigned=new URL(signed);unsigned.search='';const anonymous=await fetch(unsigned,{signal:AbortSignal.timeout(15000)});await anonymous.body?.cancel();
  console.log({signedRead:authenticated.status,unsignedRead:anonymous.status});
  if(authenticated.status!==200||![400,401,403].includes(anonymous.status))throw Error('PRIVACY_CHECK_FAILED');
  const envFile='.env.local';let env=fs.readFileSync(envFile,'utf8');env=env.replace(/^R2_PRIVATE_BUCKET_NAME=.*\r?\n?/gm,'');fs.writeFileSync(envFile,env.trimEnd()+`\nR2_PRIVATE_BUCKET_NAME=${bucket}\n`,{mode:0o600});
  console.log({privateBucketReady:true});
 }catch(error){console.log({privateBucketReady:false,code:/^[A-Za-z_]{1,60}$/.test(error.name||'')?error.name:'PROVISION_FAILED',status:error.$metadata?.httpStatusCode||null});}
 finally{if(uploaded)await client.send(new DeleteObjectCommand({Bucket:bucket,Key:key})).catch(()=>console.log({cleanup:'RETRY_REQUIRED'}));}
})();
