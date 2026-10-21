const {PrismaClient}=require('@prisma/client');
const business=require('../src/lib/plans/business.json');
const db=new PrismaClient();
async function main(){await db.$transaction(async tx=>{
 const pack=await tx.industryPack.upsert({where:{slug:'university'},update:{},create:{slug:'university',name:'دانشگاه / مدرسه',nameEn:'University / School',emoji:'🎓',tagline:'ایجنت دانشجویی و آموزش',valueProposition:'دستیار یادگیری، درس‌ها، برنامه مطالعه و پژوهش',targetCustomers:'["دانشجویان","مدارس","دانشگاه‌ها"]',painPoints:'[]',agents:'[]',outcomes:'[]',kpis:'[]',color:'#6366f1',gradientFrom:'#312e81',gradientTo:'#6366f1'}});
 const agents=JSON.parse(pack.agents);if(!agents.some(a=>a.slug==='student-workspace'))agents.push({slug:'student-workspace',name:'ایجنت دانشجویی',role:'SPECIALIST',description:'درس، جزوه، برنامه مطالعه، فلش‌کارت، آزمون و پژوهش برای حساب دانشجویی با پکیج فعال',icon:'🎓',href:'/student'});
 await tx.industryPack.update({where:{id:pack.id},data:{agents:JSON.stringify(agents)}});
 for(const [index,p] of business.entries()){
  const commonFa=['مشاور مدیرعامل، دکتر کسب‌وکار و اتاق جلسه','CRM، ایجنت فروش و تولید لید','شبکه‌های اجتماعی و فضای کار سئو','حسابداری و مدیریت مالی','طراح وبسایت و سازنده استارتاپ','چت AI، تولید تصویر، ویدئو و موسیقی با کریدت مشترک','بسته‌های صنعتی و گالری محتوا',`تا ${p.seats} عضو تیم`,`${p.credits} کریدت برای هر ماه خریداری‌شده`];
  const commonEn=['CEO advisor, business doctor and meeting room','CRM, sales agent and lead generation','Social media and SEO workspace','Accounting and finance','Website designer and startup builder','AI chat, image, video and music generation using shared credits','Industry packs and content gallery',`Up to ${p.seats} team members`,`${p.credits} credits per purchased month`];
  if(p.voiceIncluded){commonFa.unshift('مرکز تماس هوش مصنوعی');commonEn.unshift('AI Call Center');}
  else{commonFa.push('مرکز تماس در پکیج‌های رشد و مقیاس ارائه می‌شود');commonEn.push('AI Call Center is available in Growth and Scale');}
  commonFa.push('مصرف محدود به کریدت؛ هزینهٔ سرویس‌های بیرونی جداگانه');commonEn.push('Usage capped by credits; external provider charges are separate');
  const features=commonFa.join('\n'),featuresEn=commonEn.join('\n');
  await tx.package.upsert({where:{planCode:p.planCode},update:{features,featuresEn},create:{planCode:p.planCode,name:p.name,nameEn:p.nameEn,price:0,priceUsd:p.priceUsd,market:'BOTH',duration:30,credits:p.credits,teamSeatLimit:p.seats,crmSeatLimit:p.seats,isActive:true,isFeatured:p.featured,sortOrder:40+index,color:'#ea580c',features,featuresEn}});
 }
 const studentData={name:'ایجنت دانشجویی — ۳ ماه فقط ۸۰ دلار',nameEn:'Student Agent — 3 months for $80',priceUsd:8000,duration:90,features:['ویژهٔ حساب دانشجویی','فعال‌سازی در صنعت دانشگاه / مدرسه','ایجنت دانشجویی در خانه و ایجنت‌های من','درس، جزوه، برنامه مطالعه و گزارش','گروه مطالعه، فلش‌کارت، آزمون و پژوهش','ابزارهای AI با مصرف کریدت','مبلغ کل ۳ ماه: ۸۰ دلار به‌جای ۲۴۰ دلار'].join('\n'),featuresEn:['Student accounts only','University / School industry activation','Student Agent on Home and My Agents','Courses, materials, study planning and reports','Study groups, flashcards, quizzes and research','AI tools use credits','3-month total: $80 instead of $240'].join('\n')};
 await tx.package.upsert({where:{planCode:'STUDENT_FIRST_THREE_MONTHS'},update:studentData,create:{planCode:'STUDENT_FIRST_THREE_MONTHS',...studentData,price:80000000,credits:1000,market:'BOTH',color:'#6366f1',isActive:true,sortOrder:43}});
 const students=await tx.user.findMany({where:{accountType:'STUDENT',plan:{startsWith:'STUDENT_'},planExpiry:{gt:new Date()}},select:{id:true}});
 for(const u of students)await tx.user.update({where:{id:u.id},data:{industryPackId:pack.id}});
 // Revoke the call-center grant previously included in Launch. Preserve a separately purchased voice add-on.
 const owners=await tx.user.findMany({where:{plan:'TEAM'},select:{id:true}});
 let removed=0;
 for(const u of owners){
  const latest=await tx.payment.findFirst({where:{userId:u.id,status:'SUCCESS',plan:{in:business.map(p=>p.planCode)}},orderBy:[{reviewAt:'desc'},{createdAt:'desc'}]});
  if(latest?.plan==='TEAM_BUSINESS_START'){
   const standalone=await tx.payment.findMany({where:{userId:u.id,status:'SUCCESS',plan:{startsWith:'VOICE_'}},select:{reviewAt:true,createdAt:true,entitlementSnapshot:true,periodMonths:true}});
   standalone.sort((a,b)=>(a.reviewAt||a.createdAt).getTime()-(b.reviewAt||b.createdAt).getTime());
   let expiry=0;for(const p of standalone){let days=30*Math.max(1,p.periodMonths);try{const stored=JSON.parse(p.entitlementSnapshot||'{}').days;if(Number.isFinite(stored)&&stored>0)days=stored}catch{}expiry=Math.max(expiry,(p.reviewAt||p.createdAt).getTime())+days*86400000;}
   if(expiry<=Date.now()){await tx.user.update({where:{id:u.id},data:{voicePlan:'NONE',voicePlanExpiry:null}});removed++;}
  }
 }
 console.log(JSON.stringify({packagesUpdated:business.length+1,studentsLinked:students.length,launchVoiceGrantsRemoved:removed}));
},{timeout:60000});}
main().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>db.$disconnect());
