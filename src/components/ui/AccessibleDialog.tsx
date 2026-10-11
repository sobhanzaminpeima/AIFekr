"use client";
import {useEffect,useRef,type ReactNode} from "react";
export default function AccessibleDialog({label,onClose,children}:{label:string;onClose:()=>void;children:ReactNode}){
 const ref=useRef<HTMLDivElement>(null),close=useRef(onClose);close.current=onClose;
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;const dialog=ref.current;dialog?.querySelector<HTMLElement>("button,input,select,textarea,[tabindex='0']")?.focus();const old=document.body.style.overflow;document.body.style.overflow="hidden";return()=>{document.body.style.overflow=old;previous?.focus();};},[]);
 return <div ref={ref} className="commerce-modal" role="dialog" aria-modal="true" aria-label={label} onKeyDown={e=>{
  if(e.key==="Escape"){e.preventDefault();close.current();return;}
  if(e.key!=="Tab")return;
  const items=Array.from(ref.current?.querySelectorAll<HTMLElement>("button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex='0']")||[]).filter(x=>x.getClientRects().length>0);
  const first=items[0],last=items.at(-1);
  if(!first){e.preventDefault();return;}
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
 }}>{children}</div>;
}
