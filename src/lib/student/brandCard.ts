import type { Lang } from "@/lib/i18n";
import { tri } from "@/lib/i18n/tri";

export function studentBrandCopy(lang: Lang) {
  return {
    title:tri(lang,"کارت دانشجویی","Student card","Studierendenausweis","Öğrenci kartı"),
    statement: tri(lang, "من دانشجوی دانشگاه هوش مصنوعی AIFekr هستم", "I'm a student at AIFekr AI University", "Ich studiere an der AIFekr KI-Universität", "Ben AIFekr Yapay Zekâ Üniversitesi öğrencisiyim"),
    motto: tri(lang, "آینده را فقط نمی‌خوانم؛ می‌سازم.", "I don't just study the future. I build it.", "Ich lerne die Zukunft nicht nur. Ich gestalte sie.", "Geleceği sadece öğrenmiyorum. Onu inşa ediyorum."),
    community: tri(lang, "نسل تازهٔ یادگیری", "A new generation of learning", "Eine neue Generation des Lernens", "Öğrenmenin yeni nesli"),
    identity: tri(lang, "عضو جامعهٔ یادگیری AIFekr", "AIFekr learning community", "AIFekr-Lerngemeinschaft", "AIFekr öğrenme topluluğu"),
    fallbackName: tri(lang, "دانشجوی آینده", "Future builder", "Zukunftsgestalter/in", "Geleceğin mimarı"),
  };
}

// A real PNG at story resolution. Canvas avoids DOM screenshots, missing CSS,
// and font embedding failures; the displayed preview is this exact image.
export async function renderStudentBrandCard(input: { lang: Lang; name?: string | null; avatar?: string | null; slug?: string | null }): Promise<{ blob: Blob; photoIncluded: boolean }> {
  await document.fonts.ready;
  const canvas = document.createElement("canvas"); canvas.width = 1080; canvas.height = 1920;
  const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("CANVAS_UNAVAILABLE");
  const copy = studentBrandCopy(input.lang);
  const family = getComputedStyle(document.body).fontFamily || "sans-serif";
  const bg = ctx.createLinearGradient(0, 0, 1080, 1920); bg.addColorStop(0, "#111b40"); bg.addColorStop(.55, "#15132e"); bg.addColorStop(1, "#080d20");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 1080, 1920);
  for (const [x,y,color] of [[950,360,"rgba(100,92,255,.32)"],[130,1600,"rgba(255,128,48,.22)"]] as const) { const g=ctx.createRadialGradient(x,y,0,x,y,650); g.addColorStop(0,color);g.addColorStop(1,"transparent");ctx.fillStyle=g;ctx.fillRect(0,0,1080,1920); }
  ctx.strokeStyle="rgba(255,255,255,.05)";ctx.lineWidth=1;
  for(let x=0;x<=1080;x+=90){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,1920);ctx.stroke()}
  for(let y=0;y<=1920;y+=90){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(1080,y);ctx.stroke()}
  ctx.strokeStyle="rgba(255,255,255,.18)";ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(40,40,1000,1840,48);ctx.stroke();
  ctx.textAlign="center";ctx.textBaseline="middle";
  const text=(value:string,y:number,size:number,color="#ffffff",weight=600)=>{ctx.font=`${weight} ${size}px ${family}`;ctx.fillStyle=color;ctx.fillText(value,540,y,880)};
  text("AIFekr",158,78,"#ffffff",800);text(tri(input.lang,"دانشگاه هوش مصنوعی","AI UNIVERSITY","KI-UNIVERSITÄT","YAPAY ZEKÂ ÜNİVERSİTESİ"),232,26,"#c4c7ef",500);
  text(copy.title,285,30,"#ffffff",700);
  ctx.fillStyle="rgba(255,150,70,.12)";ctx.beginPath();ctx.roundRect(200,310,680,72,36);ctx.fill();text(copy.community,346,28,"#ffc08b");
  ctx.save();ctx.shadowColor="rgba(134,115,255,.5)";ctx.shadowBlur=60;ctx.fillStyle="#25234c";ctx.beginPath();ctx.arc(540,640,170,0,Math.PI*2);ctx.fill();ctx.restore();
  let photoIncluded=false;
  if(input.avatar){
    try {const response=await fetch(`/api/student/profile/avatar${input.slug?`?slug=${encodeURIComponent(input.slug)}`:""}`,{credentials:"same-origin",signal:AbortSignal.timeout(8000)});if(!response.ok)throw new Error("PHOTO_UNAVAILABLE");const photo=await createImageBitmap(await response.blob());ctx.save();ctx.beginPath();ctx.arc(540,640,155,0,Math.PI*2);ctx.clip();const crop=Math.min(photo.width,photo.height);ctx.drawImage(photo,(photo.width-crop)/2,(photo.height-crop)/2,crop,crop,385,485,310,310);ctx.restore();photo.close();photoIncluded=true;}catch{/* Initials keep image export working when remote storage disallows CORS. */}
  }
  if(!photoIncluded)text((input.name || copy.fallbackName).trim().slice(0,1).toUpperCase(),642,108,"#ded8ff",700);
  ctx.strokeStyle="#a99cff";ctx.lineWidth=5;ctx.beginPath();ctx.arc(540,640,169,0,Math.PI*2);ctx.stroke();
  ctx.direction=input.lang==="fa"?"rtl":"ltr";
  const wrap=(value:string,y:number,size:number,lineHeight:number,width:number)=>{ctx.font=`700 ${size}px ${family}`;const words=value.split(/\s+/);let line="";const lines:string[]=[];for(const word of words){const next=line?`${line} ${word}`:word;if(line&&ctx.measureText(next).width>width){lines.push(line);line=word}else line=next}if(line)lines.push(line);lines.forEach((v,i)=>text(v,y+i*lineHeight,size));return y+lines.length*lineHeight};
  wrap(input.name?.trim().slice(0,80)||copy.fallbackName,905,54,72,860);
  const end=wrap(copy.statement,1110,62,92,850);
  text(copy.motto,Math.max(1450,end+80),29,"#c8c8df",400);
  ctx.fillStyle="rgba(255,255,255,.18)";ctx.fillRect(400,1612,280,2);
  text(copy.identity,1670,26,"#c8c8df",400);
  ctx.direction="ltr";text(input.slug?`aifekr.com/student/${input.slug}`:"aifekr.com",1750,30,"#ffba80",600);
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("EXPORT_FAILED")),"image/png"));return {blob,photoIncluded};
}
