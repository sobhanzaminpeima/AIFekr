// Standard TRY subscriptions. Existing paid orders retain their snapshots.
const { PrismaClient } = require("@prisma/client");
require(require.resolve("@next/env", { paths: [require.resolve("next/package.json")] })).loadEnvConfig(process.cwd());
const prisma = new PrismaClient();
async function main() {
  const response = await fetch("https://open.er-api.com/v6/latest/USD", { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw Error("FX unavailable; prices not changed");
  const rates = await response.json();
  if (rates.result !== "success" || !(rates.rates?.TRY > 0) || !(rates.rates?.IRR > 0)) throw Error("Invalid FX response");
  const plans = [{code:"STUDENT_MONTHLY",priceTry:119999,days:30,name:"دانشجویی — یک ماه",nameEn:"Student — one month",sortOrder:15},{code:"STUDENT_QUARTERLY",priceTry:279999,days:90,name:"دانشجویی — سه ماه (۲۲٪ تخفیف)",nameEn:"Student — three months (22% off)",sortOrder:16}];
  const legacy = await prisma.package.findFirst({where:{planCode:{in:["STUDENT_FIRST_THREE_MONTHS","STUDENT_FIRST_TWO_MONTHS"]}}});
  const proposed=[];
  for(const plan of plans){
    const existing=await prisma.package.findUnique({where:{planCode:plan.code}});
    const source=existing||legacy;
    const usd=plan.priceTry/100/rates.rates.TRY;
    const data={priceTry:plan.priceTry,priceUsd:Math.round(usd*100),price:Math.round(usd*rates.rates.IRR/10)*10,name:plan.name,nameEn:plan.nameEn,duration:plan.days,market:"BOTH",isActive:true};
    proposed.push({planCode:plan.code,...data});
    if(process.argv.includes("--apply"))await prisma.package.upsert({where:{planCode:plan.code},update:data,create:{planCode:plan.code,...data,credits:source?.credits??1000,features:"درس‌ها، جزوه‌ها و یادداشت‌ها\nبرنامهٔ مطالعه و تکلیف‌ها\nزمان‌سنج و گزارش مطالعه\nگروه‌های مطالعه\nابزارهای AI با مصرف کردیت",featuresEn:"Courses, materials and notes\nStudy planning and assignments\nStudy timer and reports\nStudy groups\nAI tools consume credits",sortOrder:plan.sortOrder,color:"#ea580c"}});
  }
  if(process.argv.includes("--apply"))await prisma.package.updateMany({where:{planCode:{in:["STUDENT_FIRST_TWO_MONTHS","STUDENT_FIRST_THREE_MONTHS"]}},data:{isActive:false}});
  console.log(JSON.stringify({applied:process.argv.includes("--apply"),plans:proposed}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>prisma.$disconnect());
