// Adds the reviewed business bundles without changing legacy or admin pricing.
const { PrismaClient } = require('@prisma/client');
const packages = require('../src/lib/plans/business.json');
const db = new PrismaClient();
async function main() {
  for (const [index, p] of packages.entries()) {
    await db.package.upsert({ where: { planCode: p.planCode }, update: {}, create: {
      planCode:p.planCode, name:p.name, nameEn:p.nameEn, price:0, priceUsd:p.priceUsd,
      market:'BOTH', duration:30, credits:p.credits, teamSeatLimit:p.seats, crmSeatLimit:p.seats,
      isActive:true, isFeatured:p.featured, sortOrder:40+index, color:'#ea580c',
      features: ['تیم کامل AI: مدیریت، فروش، محتوا و سئو','CRM و حسابداری در همین اشتراک','تصویر، ویدیو، موسیقی و ساخت وبسایت با اعتبار مشترک',`تا ${p.seats} عضو`,`${p.credits} اعتبار برای هر ماه خریداری‌شده`,'مصرف محدود به اعتبار؛ اتصال سرویس‌های بیرونی و هزینه تماس جداگانه'].join('\n'),
      featuresEn: ['Full AI team: strategy, sales, content and SEO','CRM and accounting included','Images, video, music and websites use shared credits',`Up to ${p.seats} members`,`${p.credits} credits per purchased month`,'Usage capped by credits; external service and call charges are separate'].join('\n'),
    }});
  }
  console.log('Business packages ready; existing pricing preserved.');
}
main().catch(error => { console.error(error.message); process.exitCode=1; }).finally(() => db.$disconnect());
