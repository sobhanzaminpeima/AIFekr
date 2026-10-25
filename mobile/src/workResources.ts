import {z} from 'zod';
export type WorkModule='deals'|'tasks'|'courses'|'exams'|'properties'|'rentals'|'invoices'|'calls'|'appointments';
export type Resource={id:string;title:string;detail:string;date?:string|null};
const deals=z.object({deals:z.array(z.object({id:z.string(),title:z.string(),status:z.string(),probability:z.number()}))});
const tasks=z.object({tasks:z.array(z.object({id:z.string(),title:z.string(),status:z.string(),dueDate:z.string().nullable()}))});
const courses=z.object({courses:z.array(z.object({id:z.string(),name:z.string(),courseCode:z.string().nullable(),institution:z.string().nullable()}))});
const exams=z.object({exams:z.array(z.object({id:z.string(),title:z.string(),examAt:z.string(),course:z.object({name:z.string()})}))});
const properties=z.object({properties:z.array(z.object({id:z.string(),title:z.string(),address:z.string(),status:z.string(),price:z.number(),currency:z.string(),listingType:z.string(),nightlyPrice:z.number().nullable()}))});
const invoices=z.object({invoices:z.array(z.object({id:z.string(),invoiceNumber:z.string(),status:z.string(),total:z.number(),currency:z.string(),dueDate:z.string().nullable()}))});
const calls=z.object({calls:z.array(z.object({id:z.string(),callerPhone:z.string().nullable(),summary:z.string().nullable(),status:z.string(),createdAt:z.string()}))});
const appointments=z.object({appointments:z.array(z.object({id:z.string(),leadName:z.string().nullable(),scheduledAt:z.string(),status:z.string()}))});
export const resourcePaths:Record<WorkModule,string>={deals:'/api/crm/deals',tasks:'/api/crm/tasks',courses:'/api/student/courses',exams:'/api/student/exams',properties:'/api/mobile/v1/work?module=properties',rentals:'/api/mobile/v1/work?module=rentals',invoices:'/api/mobile/v1/work?module=invoices',calls:'/api/mobile/v1/work?module=calls',appointments:'/api/mobile/v1/work?module=appointments'};
export function parseResources(module:WorkModule,raw:unknown,locale:string):Resource[]{
 switch(module){
  case 'deals':return deals.parse(raw).deals.map(d=>({id:d.id,title:d.title,detail:`${d.status} · ${new Intl.NumberFormat(locale,{style:'percent'}).format(d.probability/100)}`}));
  case 'tasks':return tasks.parse(raw).tasks.map(t=>({id:t.id,title:t.title,detail:t.status,date:t.dueDate}));
  case 'courses':return courses.parse(raw).courses.map(c=>({id:c.id,title:c.name,detail:[c.courseCode,c.institution].filter(Boolean).join(' · ')}));
  case 'exams':return exams.parse(raw).exams.map(e=>({id:e.id,title:e.title,detail:e.course.name,date:e.examAt}));
  case 'properties':case 'rentals':return properties.parse(raw).properties.map(p=>{const amount=p.listingType==='short_term_rent'?p.nightlyPrice:p.price;return {id:p.id,title:p.title,detail:`${p.address} · ${p.status}${amount===null?'':` · ${new Intl.NumberFormat(locale).format(amount)} ${p.currency}`}`};});
  case 'invoices':return invoices.parse(raw).invoices.map(i=>({id:i.id,title:i.invoiceNumber,detail:`${i.status} · ${new Intl.NumberFormat(locale).format(i.total)} ${i.currency}`,date:i.dueDate}));
  case 'calls':return calls.parse(raw).calls.map(c=>({id:c.id,title:c.callerPhone||c.status,detail:c.summary||c.status,date:c.createdAt}));
  case 'appointments':return appointments.parse(raw).appointments.map(a=>({id:a.id,title:a.leadName||a.status,detail:a.status,date:a.scheduledAt}));
 }
}
