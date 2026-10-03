const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('fs');
const path = require('path');
(async()=>{
 const browser=await chromium.launch({headless:true});
 const catalog=fs.readFileSync('src/lib/marketing/catalog.ts','utf8');
 const featureSlugs=[...catalog.split('export const solutionCatalog')[0].matchAll(/slug: "([^"]+)"/g)].map(m=>m[1]);
 const solutionSlugs=['business','creators','real-estate','students'];
 const allRoutes=['/','/pricing','/about','/contact','/industry','/ai-team','/privacy','/terms','/security',...featureSlugs.map(s=>'/features/'+s),...solutionSlugs.map(s=>'/solutions/'+s)];
 const routes=process.env.QA_MAIN_ONLY ? ['/','/pricing','/features/education','/solutions/students'] : allRoutes;
 const widths=(process.env.QA_WIDTHS || '320,390,768,1440').split(',').map(Number);
 const errors=[],checks=[];
 fs.mkdirSync('/private/tmp/aifekr-qa',{recursive:true});
 for(const lang of ['fa','en','de','tr']){
 const context=await browser.newContext(); await context.addCookies([{name:'lang',value:lang,url:'http://127.0.0.1:3006'}]);
 const page=await context.newPage();page.on('pageerror',e=>errors.push({lang,error:e.message}));
 for(const width of widths){
  await page.setViewportSize({width,height:900});
  for(const route of routes){
   const response=await page.goto('http://127.0.0.1:3006'+route,{waitUntil:'domcontentloaded'}); await page.waitForTimeout(60);
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);
   const h1=await page.locator('h1').count();
   checks.push({lang,width,route,status:response.status(),overflow,h1});
   if(response.status()!==200||overflow||h1!==1)errors.push(checks.at(-1));
  }
  if([320,1440].includes(width)){await page.goto('http://127.0.0.1:3006',{waitUntil:'domcontentloaded'});await page.screenshot({path:`/private/tmp/aifekr-qa/home-${lang}-${width}.png`,fullPage:true});}
 }
 await page.setViewportSize({width:390,height:900});await page.goto('http://127.0.0.1:3006',{waitUntil:'domcontentloaded'});await page.locator('.m-menu-toggle').click();await page.locator('.m-nav-group button').first().click();if(await page.locator('.m-mega a').count()<1)errors.push({lang,error:'mobile mega menu missing'});await page.keyboard.press('Escape');
 await context.close();
 }
 await browser.close();fs.writeFileSync(`/private/tmp/aifekr-qa/results-${process.env.QA_MAIN_ONLY ? "supplement" : "all"}.json`,JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks:checks.length,errors}));if(errors.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
