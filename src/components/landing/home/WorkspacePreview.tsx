"use client";
import { useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { Users, AudioLines, PanelsTopLeft, ChevronLeft, ChevronRight, Sparkles, FileCheck2, CircleCheck } from "lucide-react";
import { landingCopy } from "@/lib/i18n/landing";
import type { UiLocale } from "@/lib/i18n/foundation";
const icons=[Users,PanelsTopLeft,AudioLines];
const links=['/crm','/social','/voice-agent'];
export default function WorkspacePreview({locale}:{locale:UiLocale}){
 const [active,setActive]=useState(0);const tabs=useRef<(HTMLButtonElement|null)[]>([]);const s=landingCopy[locale];const p=s.previews[active];const Icon=icons[active];const Chevron=locale==='fa'?ChevronLeft:ChevronRight;
 function navigate(e:KeyboardEvent<HTMLButtonElement>,index:number){let next=index;const sign=locale==='fa'?-1:1;if(e.key==='ArrowRight')next=(index+sign+3)%3;else if(e.key==='ArrowLeft')next=(index-sign+3)%3;else if(e.key==='Home')next=0;else if(e.key==='End')next=2;else return;e.preventDefault();setActive(next);tabs.current[next]?.focus();}
 return <div className="lp-workspace" id="workspace-preview">
   <div className="lp-workspace-top"><span><Sparkles size={16} aria-hidden="true"/> {s.workspace}</span><span className="lp-preview-label">{s.previewLabel}</span></div>
   <div className="lp-workspace-title"><h2>{s.previewTitle}</h2><p>{s.previewNote}</p></div>
   <div role="tablist" aria-label={s.previewLabel} className="lp-tabs">{s.previewTabs.map((label,i)=>{const TabIcon=icons[i];return <button type="button" key={label} id={`preview-tab-${i}`} role="tab" ref={el=>{tabs.current[i]=el;}} aria-selected={active===i} aria-controls="preview-panel" tabIndex={active===i?0:-1} onClick={()=>setActive(i)} onKeyDown={e=>navigate(e,i)}><TabIcon size={16} aria-hidden="true"/>{label}</button>})}</div>
   <div className="lp-preview-panel" id="preview-panel" role="tabpanel" aria-labelledby={`preview-tab-${active}`} tabIndex={0}>
    <div className="lp-preview-icon"><Icon size={24} aria-hidden="true"/></div><h3>{p.title}</h3><p>{p.description}</p>
    <div className="lp-flow-label"><FileCheck2 size={14} aria-hidden="true"/>{p.label}</div>
    <ol className="lp-flow">{p.steps.map((step,i)=><li key={step}><span className="lp-flow-number">{new Intl.NumberFormat(locale).format(i+1)}</span><span>{step}</span>{i<2&&<Chevron size={14} aria-hidden="true"/>}</li>)}</ol>
    <div className="lp-preview-detail"><CircleCheck size={15} aria-hidden="true"/><span>{p.detail}</span></div>
    <Link className="lp-text-link" href={links[active]}>{p.link}<Chevron size={15} aria-hidden="true"/></Link>
   </div>
 </div>;
}
