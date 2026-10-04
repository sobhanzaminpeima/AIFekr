"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { studentEntryHref } from "@/lib/student/entry";
import { STUDENT_PLAN_CODE } from "@/lib/plans/studentOffer";
export default function StudentActivationLink({ children, className, style, plan = STUDENT_PLAN_CODE, intent = "workspace" }: { children: React.ReactNode; className?: string; style?: React.CSSProperties; plan?: string; intent?: "workspace" | "purchase" }) {
  const [href, setHref] = useState(`/plans?plan=${encodeURIComponent(plan)}&period=monthly`);
  useEffect(() => { let cancelled=false;
    fetch("/api/auth/me",{credentials:"include",cache:"no-store"}).then(async response=>{if(response.status===401){if(!cancelled)setHref(studentEntryHref(null,plan,intent));return}if(response.ok){const data=await response.json();if(!cancelled)setHref(studentEntryHref(data.user,plan,intent))}}).catch(()=>{});
    return()=>{cancelled=true};
  },[plan,intent]);
  return <Link href={href} className={className} style={style}>{children}</Link>;
}
