const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {PrismaClient}=require('@prisma/client');
const jwt=require('jsonwebtoken');
(async()=>{
 const db=new PrismaClient();const id='qa-exams-'+Date.now();let browser;
 try{
  await db.user.create({data:{id,name:'Exam QA',email:id+'@example.test',onboardingDone:true,accountType:'STUDENT',plan:'STUDENT_QUARTERLY',planExpiry:new Date(Date.now()+90*86400000)}});
  const course=await db.studentCourse.create({data:{userId:id,name:'Physics QA'}});
  await db.studentExam.create({data:{userId:id,courseId:course.id,title:'QA Midterm',examAt:new Date('2026-11-01T10:00:00Z')}});
  const token=jwt.sign({userId:id,role:'USER',plan:'STUDENT_QUARTERLY'},process.env.JWT_SECRET,{expiresIn:'1h'});
  browser=await chromium.launch();const ctx=await browser.newContext({viewport:{width:390,height:844}});await ctx.addCookies([{name:'token',value:token,url:'http://127.0.0.1:3006'},{name:'lang',value:'en',url:'http://127.0.0.1:3006'}]);
  const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:3006/student?view=planner',{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'Edit exam',exact:true}).waitFor();
  await page.getByRole('button',{name:'Edit exam',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByLabel('Exam title').fill('QA Final');await dialog.getByLabel('Date and time').fill('2026-12-01T14:30');await dialog.getByRole('button',{name:'Save',exact:true}).click();await page.getByText('QA Final',{exact:true}).waitFor();
  await page.screenshot({path:'/private/tmp/aifekr-qa/student-exams-mobile.png',fullPage:true});
  page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Delete exam',exact:true}).click();await page.getByText('QA Final',{exact:true}).waitFor({state:'detached'});
  if(await db.studentExam.count({where:{userId:id}})!==0)throw new Error('Exam deletion did not persist');
  if(errors.length)throw new Error(errors.join('\n'));console.log('Student exam edit/date change/delete browser flow passed on mobile.');
 }finally{if(browser)await browser.close();await db.studentCourse.deleteMany({where:{userId:id}});await db.user.deleteMany({where:{id}});await db.$disconnect();}
})().catch(e=>{console.error(e);process.exitCode=1});
