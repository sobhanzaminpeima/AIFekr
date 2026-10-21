import {PrismaClient} from '@prisma/client';
const p=new PrismaClient();
try{
 const source=await p.package.findUniqueOrThrow({where:{planCode:'TEAM_BUSINESS_SCALE'}});
 const {id,createdAt,updatedAt,...copy}=source;void id;void createdAt;void updatedAt;
 await p.package.upsert({where:{planCode:'BUSINESS_SPECIAL_89'},update:{},create:{...copy,planCode:'BUSINESS_SPECIAL_89',name:'آفر ویژه تیم کامل هوش مصنوعی',nameEn:'Complete AI team · special offer',priceUsd:8900,baseCurrency:'USD',termPrices:JSON.stringify({monthly:8900}),badge:'$349 → $89',isFeatured:true,sortOrder:-10,publicationStatus:'PUBLISHED',publicVisible:true,isActive:true}});
 console.log('Special offer ready; existing entitlements and limits preserved.');
}finally{await p.$disconnect();}
