"use client";
import { useEffect, useState } from "react";
import { Download, Loader2, Share2 } from "lucide-react";
import { tri, type Lang } from "@/lib/i18n";
import { shareCardImage } from "@/lib/student/shareCard";
import { renderStudentBrandCard, studentBrandCopy } from "@/lib/student/brandCard";

export default function StudentBrandCard({ lang, name, avatar, publicSlug }: { lang: Lang; name?: string | null; avatar?: string | null; publicSlug?: string | null }) {
  const [image, setImage] = useState<{ file: File; url: string; photoIncluded: boolean } | null>(null);
  const [error, setError] = useState(""); const [notice,setNotice]=useState("");const [sharing,setSharing]=useState(false);
  const [revision, setRevision] = useState(0);
  const copy=studentBrandCopy(lang);
  useEffect(()=>{let cancelled=false;let url="";setImage(null);setError("");setNotice("");
    renderStudentBrandCard({lang,name,avatar,slug:publicSlug}).then(({blob,photoIncluded})=>{if(cancelled)return;url=URL.createObjectURL(blob);setImage({file:new File([blob],`AIFekr-student-${lang}.png`,{type:"image/png"}),url,photoIncluded})}).catch(()=>{if(!cancelled)setError(tri(lang,"ساخت عکس کارت انجام نشد؛ دوباره تلاش کن.","Couldn't create your card image. Try again.","Das Kartenbild konnte nicht erstellt werden. Versuche es erneut.","Kart görseli oluşturulamadı. Tekrar dene."))});
    return()=>{cancelled=true;if(url)URL.revokeObjectURL(url)};
  },[lang,name,avatar,publicSlug,revision]);
  function download(){if(!image)return;const a=document.createElement("a");a.href=image.url;a.download=image.file.name;document.body.append(a);a.click();a.remove();setNotice(tri(lang,"عکس کارت دانلود شد؛ در استوری یا پست انتخابش کن.","Card image downloaded. Choose it for your story or post.","Kartenbild heruntergeladen. Wähle es für deine Story oder deinen Beitrag.","Kart görseli indirildi. Hikâyende veya gönderinde seç."))}
  async function share(){if(!image)return;setError("");setSharing(true);try{
    // Use the prepared file directly inside the click, preserving mobile user activation.
    await shareCardImage(image.file,copy.statement,navigator,download);
  }catch(e){if(!(e instanceof Error&&e.name==="AbortError"))setError(tri(lang,"اشتراک‌گذاری انجام نشد؛ عکس کارت را دانلود کن.","Sharing failed. Download the card image instead.","Teilen fehlgeschlagen. Lade das Kartenbild herunter.","Paylaşım başarısız. Kart görselini indir."))}finally{setSharing(false)}}
  return <div className="min-w-0 space-y-3">
    <div className="mx-auto w-full max-w-[360px] overflow-hidden rounded-3xl border border-indigo-300/20 bg-[#10162f] shadow-xl" style={{aspectRatio:"9 / 16"}}>
      {image?<img src={image.url} alt={`${name||copy.fallbackName} — ${copy.statement}`} className="h-full w-full object-contain"/>:error?<div className="flex h-full min-h-[360px] items-center justify-center text-white"><button type="button" className="rounded-xl border border-white/30 px-5 py-3" onClick={()=>setRevision(value=>value+1)}>{tri(lang,"ساخت دوباره کارت","Retry card","Karte erneut erstellen","Kartı yeniden oluştur")}</button></div>:<div className="flex h-full min-h-[360px] items-center justify-center text-white"><Loader2 className="animate-spin" aria-label={tri(lang,"آماده‌سازی کارت","Preparing card","Karte wird erstellt","Kart hazırlanıyor")}/></div>}
    </div>
    <div className="flex flex-wrap gap-2"><button type="button" disabled={!image||sharing} onClick={()=>void share()} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{sharing?<Loader2 size={16} className="animate-spin"/>:<Share2 size={16}/>} {tri(lang,"اشتراک عکس کارت","Share card image","Kartenbild teilen","Kart görselini paylaş")}</button><button type="button" disabled={!image} onClick={download} className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm disabled:opacity-50" style={{borderColor:"var(--border, #475569)"}}><Download size={16}/>{tri(lang,"دانلود عکس","Download image","Bild herunterladen","Görseli indir")}</button></div>
    <p className="text-xs leading-5 opacity-70">{tri(lang,"آمادهٔ استوری · ۱۰۸۰ × ۱۹۲۰ · عکس کارت با نام و تصویر تو، بدون ایمیل","Story ready · 1080 × 1920 · Your name and photo, without your email","Story-Format · 1080 × 1920 · Name und Foto, ohne E-Mail","Hikâyeye hazır · 1080 × 1920 · Adın ve fotoğrafın; e-posta yok")}</p>
    {image&&avatar&&!image.photoIncluded&&<p className="text-xs opacity-70">{tri(lang,"عکس پروفایل بارگذاری نشد؛ کارت با حرف اول نام آماده شد.","Your photo couldn't load; your card uses your initial.","Dein Foto konnte nicht geladen werden; die Karte zeigt deinen Anfangsbuchstaben.","Fotoğrafın yüklenemedi; kartında adının ilk harfi kullanıldı.")}</p>}
    {error&&<p role="alert" className="text-sm text-red-500">{error}</p>}{notice&&<p role="status" className="text-sm text-emerald-500">{notice}</p>}
  </div>;
}
