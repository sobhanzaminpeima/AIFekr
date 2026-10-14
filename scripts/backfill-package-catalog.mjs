import {PrismaClient} from '@prisma/client';
const p=new PrismaClient();
async function main(){
 const rows=await p.package.findMany();
 for(const row of rows){
  if(!row.planCode.startsWith('STUDENT_')&&!row.planCode.startsWith('TEAM_BUSINESS_'))continue;
  const category=row.planCode.startsWith('STUDENT_')?'STUDENT':'BUSINESS';
  let prices;try{prices=JSON.parse(row.termPrices||'{}');}catch{prices={};}
  const data={category};
  if(!Object.keys(prices).length){
   const currency=row.priceTry!=null?'TRY':row.priceUsd!=null?'USD':'IRT';
   const base=row.priceTry??row.priceUsd??Math.round(row.price/10);
   if(base<=0)continue;
   data.baseCurrency=currency;
   data.termPrices=JSON.stringify(category==='STUDENT'?{[row.duration>=80?'quarterly':'monthly']:base}:{monthly:base,quarterly:Math.round(base*3*.9),semiannual:Math.round(base*6*.8)});
   if(category==='BUSINESS')data.creditAllocation='MONTHLY_TOTAL';
  }
  await p.package.update({where:{id:row.id},data});
 }
 console.log(JSON.stringify(await p.package.findMany({where:{isActive:true},select:{planCode:true,category:true,termPrices:true,baseCurrency:true}})));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>p.$disconnect());
