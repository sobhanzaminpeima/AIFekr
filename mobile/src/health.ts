import {Platform} from 'react-native';
export type StepReading={steps:number|null;start:string;end:string;source:'Apple Health'|'Health Connect'};
export async function readTodaySteps():Promise<StepReading>{
 const end=new Date(),start=new Date(end);start.setHours(0,0,0,0);
 let steps:number|undefined;let source:StepReading['source'];
 if(Platform.OS==='ios'){
  const health=await import('@kingstinct/react-native-healthkit');
  if(!await health.isHealthDataAvailable())throw new Error('Apple Health is unavailable on this device.');
  await health.requestAuthorization({toRead:['HKQuantityTypeIdentifierStepCount']});
  const result=await health.queryStatisticsForQuantity('HKQuantityTypeIdentifierStepCount',['cumulativeSum'],{unit:'count',filter:{date:{startDate:start,endDate:end}}});
  steps=result.sumQuantity?.quantity;source='Apple Health';
 }else if(Platform.OS==='android'){
  const health=await import('react-native-health-connect');
  if(!await health.initialize())throw new Error('Health Connect is unavailable. Install or update it in Android settings.');
  const permissions=await health.requestPermission([{accessType:'read',recordType:'Steps'}]);
  if(!permissions.some(p=>p.accessType==='read'&&p.recordType==='Steps'))throw new Error('Step permission was not granted.');
  const result=await health.aggregateRecord({recordType:'Steps',timeRangeFilter:{operator:'between',startTime:start.toISOString(),endTime:end.toISOString()}});
  steps=result.COUNT_TOTAL;source='Health Connect';
 }else throw new Error('Health access requires an Android or iOS development build.');
 if(steps!==undefined&&(!Number.isFinite(steps)||steps<0))throw new Error('Invalid step total from health provider.');
 return {steps:steps===undefined?null:Math.round(steps),start:start.toISOString(),end:end.toISOString(),source};
}
