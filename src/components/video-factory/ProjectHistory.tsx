"use client";
import {useEffect,useState} from "react";
import {useTranslation} from "@/lib/i18n";
import {factoryApi} from "./client";
export default function ProjectHistory({projectId,version,onChange}:{projectId:string;version:number;onChange:()=>Promise<unknown>}){
  const {lang}=useTranslation(),t=(fa:string,en:string)=>lang==="fa"?fa:en;
  const [versions,setVersions]=useState<{id:string;version:number;createdAt:string}[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState("");
  useEffect(()=>{factoryApi<{versions:typeof versions}>(`/api/video-factory/projects/${projectId}/versions`).then(value=>setVersions(value.versions)).catch(e=>setError(e.message));},[projectId,version]);
  return <section className="vf-panel"><h2>{t("تاریخچه نسخه‌های متن و پروژه","Script & project version history")}</h2><p>{t("نسخه فعلی","Current version")}: {version}</p>{error&&<p className="vf-error" role="alert">{error}</p>}{!versions.length&&<p>{t("پس از اولین ویرایش، نسخه‌های قبلی اینجا نگهداری می‌شوند.","Previous versions appear after the first edit.")}</p>}{versions.map(v=><article className="vf-shot" key={v.id}><h3>v{v.version}</h3><p>{new Date(v.createdAt).toLocaleString(lang)}</p><button disabled={busy} onClick={async()=>{setBusy(true);setError("");try{await factoryApi(`/api/video-factory/projects/${projectId}/versions`,{version:v.version,expectedVersion:version});await onChange();}catch(e){setError(e instanceof Error?e.message:"RESTORE_FAILED");}finally{setBusy(false);}}}>{t("بازیابی به‌عنوان نسخه جدید · بدون هزینه","Restore as a new version · no charge")}</button></article>)}</section>;
}
