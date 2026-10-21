/* Explicitly authorized paid smoke. At most 1500 output tokens and one 4-step image. No production payment or credit records. */
const fs=require('fs'),path=require('path'),Module=require('module');require('@next/env').loadEnvConfig(process.cwd());
const original=Module._resolveFilename;Module._resolveFilename=function(name,parent,...rest){return original.call(this,name.startsWith('@/')?path.join(process.cwd(),'src',name.slice(2)):name,parent,...rest);};
require.extensions['.ts']=function(mod,file){const ts=require('typescript');mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,file);};
(async()=>{
 if(process.env.AIFEKR_PAID_SMOKE_APPROVED!=='true')throw Error('EXPLICIT_SMOKE_APPROVAL_REQUIRED');
 const {workersAiCredentials,workersAiImage}=require('../src/lib/cloudflare/workersAi.ts'),{generateChapter}=require('../src/lib/video-factory/providers.ts'),{mediaCommand}=require('../src/lib/video-factory/render.ts');
 const {chapterSchema}=require('../src/lib/video-factory/domain.ts'),cf=await workersAiCredentials(),provider={id:'cloudflare-authorized-smoke',name:'Cloudflare smoke',model:'@cf/meta/llama-3.3-70b-instruct-fp8-fast',provider:'cloudflare',baseURL:cf.baseURL,apiKey:cf.key,structuredJson:true,maxTokens:1500,maxOutputCeiling:1500,strengths:[],creditCost:0};
 const context={brief:'A short educational introduction to the solar system',configuration:{language:'en',durationSeconds:15,shotsPerChapter:1},chapterPrefix:'c1',chapter:0,pipeline:'IMAGE_MOTION'};
 const result=await generateChapter('smoke',context,AbortSignal.timeout(90000),provider,'');
 const chapter=chapterSchema.parse(result.chapter),dir='/tmp/aifekr-workers-video-smoke-'+Date.now();fs.mkdirSync(dir,{mode:0o700});
 const image=path.join(dir,'scene.png');fs.writeFileSync(image,await workersAiImage('@cf/black-forest-labs/flux-1-schnell',chapter.shots[0].visualPrompt));
 const output=path.join(dir,'film.mp4');
 await mediaCommand('ffmpeg',['-y','-loop','1','-i',image,'-vf',"scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,zoompan=z='min(zoom+0.0005,1.08)':d=360:s=1280x720:fps=24",'-t','15','-c:v','libx264','-threads','1','-preset','ultrafast','-pix_fmt','yuv420p','-movflags','+faststart',output],AbortSignal.timeout(120000));
 const duration=Number(JSON.parse(await mediaCommand('ffprobe',['-v','error','-show_entries','format=duration','-of','json',output])).format.duration);if(Math.abs(duration-15)>.1)throw Error('DURATION_FAILED');
 console.log(JSON.stringify({structuredScriptValid:true,generatedImageBytes:fs.statSync(image).size,videoBytes:fs.statSync(output).size,output,usage:result.usage,paidCalls:2,productionBalancesChanged:false}));
})().catch(e=>{console.error(e.message);process.exitCode=1}).finally(async()=>{try{await require('../src/lib/db/prisma.ts').prisma.$disconnect();}catch{}});
