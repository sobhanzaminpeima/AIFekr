"use client";
import {useTranslation,tri} from "@/lib/i18n";
import type {PublicQuestion,QuizAnswer} from "@/lib/courses/assessment";
export function hasAnswer(q:PublicQuestion,a:QuizAnswer|undefined){
 if(q.type==="shortAnswer")return typeof a==="string"&&!!a.trim();
 if(q.type==="trueFalse")return typeof a==="boolean";
 if(q.type==="multipleChoice")return typeof a==="number";
 if(q.type==="multipleSelect")return Array.isArray(a)&&a.length>0;
 const size=q.type==="ordering"?q.items.length:(q.left||[]).length;
 return Array.isArray(a)&&a.length===size&&a.every(v=>Number.isInteger(v)&&v>=0&&v<size)&&new Set(a).size===size;
}
export default function AssessmentQuestion({question:q,value,onChange,name}:{question:PublicQuestion;value:QuizAnswer|undefined;onChange:(a:QuizAnswer)=>void;name:string}){
 const {lang}=useTranslation();
 const style="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-slate-500/30 p-3";
 if(q.type==="shortAnswer")return <textarea aria-label={q.question} className="min-h-24 w-full rounded-xl border bg-transparent p-3" value={typeof value==="string"?value:""} maxLength={2000} onChange={e=>onChange(e.target.value)}/>;
 if(q.type==="trueFalse")return <div className="space-y-3">{[true,false].map(v=><label key={String(v)} className={style}><input type="radio" name={name} checked={value===v} onChange={()=>onChange(v)}/>{v?tri(lang,"درست","True","Richtig","Doğru"):tri(lang,"نادرست","False","Falsch","Yanlış")}</label>)}</div>;
 if(q.type==="multipleChoice"||q.type==="multipleSelect")return <div className="space-y-3">{q.options.map((option,i)=><label key={i} className={style}><input type={q.type==="multipleSelect"?"checkbox":"radio"} name={name} checked={q.type==="multipleSelect"?Array.isArray(value)&&value.includes(i):value===i} onChange={()=>{if(q.type==="multipleChoice")onChange(i);else{const current=Array.isArray(value)?value:[];onChange(current.includes(i)?current.filter(v=>v!==i):[...current,i]);}}}/>{option}</label>)}</div>;
 const labels=q.type==="ordering"?q.items:(q.left||[]),options=q.type==="ordering"?q.items:(q.right||[]);
 return <div className="space-y-3">{labels.map((label,i)=><label key={i} className="block space-y-2"><span>{q.type==="ordering"?`${i+1}.`:label}</span><select aria-label={`${q.question}: ${i+1}`} className="min-h-12 w-full rounded-xl border bg-slate-950 p-3" value={Array.isArray(value)&&Number.isInteger(value[i])?value[i]:""} onChange={e=>{const next=Array.isArray(value)?[...value]:Array(labels.length).fill(-1);next[i]=Number(e.target.value);onChange(next);}}><option value="" disabled>—</option>{options.map((o,j)=><option key={j} value={j}>{o}</option>)}</select></label>)}</div>;
}
