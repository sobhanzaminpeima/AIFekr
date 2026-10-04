"use client";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
type Agent = {id:string;name:string;user:{name:string|null;email:string|null};vapiPhoneNumberId:string|null};
export default function VoiceServiceAdmin() {
  const [calls,setCalls]=useState<{id:string;vapiCallId:string|null;status:string;billingStatus:string;reservedCredits:number;creditsCharged:number;durationSec:number|null;agent:{name:string};user:{name:string|null;email:string|null}}[]>([]);
  async function loadCalls(){try{const r=await fetch("/api/admin/voice-agent/calls");if(!r.ok)throw new Error();setCalls((await r.json()).calls);}catch{setError("دریافت گزارش تماس انجام نشد؛ دوباره تلاش کنید.");}}
  async function reconcile(id:string){setBusy(true);setError("");try{const r=await fetch(`/api/admin/voice-agent/calls/${id}/reconcile`,{method:"POST"});const d=await r.json();if(!r.ok)throw new Error(d.error);await loadCalls();toast.success("تسویه بررسی شد");}catch(e){setError(e instanceof Error?e.message:"خطا");}finally{setBusy(false);}}
  const [form,setForm]=useState<Record<string,string>>({});
  const [ready,setReady]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [numbers,setNumbers]=useState<{id:string;number:string}[]>([]);
  const [agents,setAgents]=useState<Agent[]>([]);
  const [agent,setAgent]=useState("");
  const [number,setNumber]=useState("");
  async function load() {
    try {
      const res=await fetch("/api/admin/voice-agent/config"); if(!res.ok) throw new Error("دریافت تنظیمات انجام نشد");
      const d=await res.json(); setReady(d.apiKeyConfigured&&d.webhookConfigured&&!!d.credentialId);
      setForm({vapi_private_key:"",vapi_webhook_secret:"",vapi_credential_id:d.credentialId,vapi_model:d.model,vapi_voice_id:d.voiceId,vapi_credits_per_minute:String(d.creditsPerMinute),vapi_max_duration_seconds:String(d.maxDurationSeconds)});
    } catch(e) {setError(e instanceof Error?e.message:"خطا");}
  }
  useEffect(()=>{void load();void loadCalls().catch(()=>setError("دریافت تماس‌ها انجام نشد"));},[]);
  async function inventory() {
    setBusy(true);setError("");
    try {const r=await fetch("/api/admin/voice-agent/numbers");const d=await r.json();if(!r.ok)throw new Error(d.error);setNumbers(d.numbers);setAgents(d.agents);toast.success("اتصال Vapi و فهرست شماره‌ها بررسی شد");}
    catch(e){setError(e instanceof Error?e.message:"اتصال انجام نشد");}finally{setBusy(false);}
  }
  async function save() {
    setBusy(true);setError("");
    try {const r=await fetch("/api/admin/voice-agent/config",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(Object.fromEntries(Object.entries(form).filter(([,v])=>v.trim())))});const d=await r.json();if(!r.ok)throw new Error(d.error);await load();toast.success("تنظیمات ذخیره شد");}
    catch(e){setError(e instanceof Error?e.message:"خطا");}finally{setBusy(false);}
  }
  async function assign() {
    setBusy(true);setError("");
    try {const r=await fetch(`/api/voice-agent/agents/${agent}/provision`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({phoneNumberId:number})});const d=await r.json();if(!r.ok)throw new Error(d.error);toast.success("شماره به ایجنت متصل شد");await inventory();}
    catch(e){setError(e instanceof Error?e.message:"اتصال انجام نشد");}finally{setBusy(false);}
  }
  return <section className="rounded-2xl border p-4 sm:p-6 space-y-4" style={{background:"var(--surface-1)",borderColor:"var(--border)"}}>
    <h2 className="font-bold">راه‌اندازی سرویس تماس · {ready?"تنظیمات کامل":"نیازمند تنظیم"}</h2>
    <ol className="list-decimal list-inside text-sm space-y-2" style={{color:"var(--text-secondary)"}}>
      <li>حساب Vapi را شارژ و شمارهٔ مجازی را در بخش Phone Numbers وارد کنید.</li>
      <li>کلید خصوصی و رمز وب‌هوک را اینجا ثبت کنید. همان رمز را در Vapi → Server Configuration به‌صورت Bearer Token ذخیره و Credential ID آن را وارد کنید.</li>
      <li>اتصال را بررسی کنید، ایجنت مشتری و شماره را انتخاب و متصل کنید. هر شماره فقط برای یک ایجنت است.</li>
      <li>مشتری سناریو، زبان، ساعت پذیرش و دانش‌نامه را آماده کند؛ سپس یک تماس آزمایشی واقعی با شماره انجام دهید.</li>
    </ol>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{([
      ["vapi_private_key","کلید خصوصی Vapi","password"],["vapi_webhook_secret","رمز وب‌هوک (حداقل ۳۲ کاراکتر)","password"],["vapi_credential_id","Vapi Credential ID","text"],["vapi_model","مدل OpenAI در Vapi","text"],["vapi_voice_id","شناسهٔ صدای ElevenLabs","text"],["vapi_credits_per_minute","کریدت هر دقیقه","number"],["vapi_max_duration_seconds","حداکثر مدت تماس (ثانیه)","number"]
    ]).map(([key,label,type])=><label key={key} className="text-xs space-y-2"><span>{label}</span><input aria-label={label} type={type} value={form[key]||""} onChange={e=>setForm({...form,[key]:e.target.value})} placeholder={type==="password"?"خالی = حفظ مقدار ذخیره‌شده":""} dir="ltr" className="block w-full rounded-xl p-3" style={{background:"var(--surface-2)",color:"var(--text-primary)"}}/></label>)}</div>
    {error&&<p role="alert" className="text-sm text-red-500">{error}</p>}
    <div className="flex flex-wrap gap-3"><button disabled={busy} onClick={()=>void save()} className="workspace-button">ذخیره تنظیمات</button><button disabled={busy} onClick={()=>void inventory()} className="workspace-button secondary">بررسی اتصال و شماره‌ها</button></div>
    {!!numbers.length&&<div className="grid gap-3 sm:grid-cols-3">
      <select aria-label="ایجنت مشتری" value={agent} onChange={e=>setAgent(e.target.value)} className="rounded-xl p-3 min-w-0" style={{background:"var(--surface-2)"}}><option value="">انتخاب ایجنت مشتری</option>{agents.map(a=><option key={a.id} value={a.id}>{a.user.name||a.user.email} · {a.name}</option>)}</select>
      <select aria-label="شماره مجازی" value={number} onChange={e=>setNumber(e.target.value)} className="rounded-xl p-3 min-w-0" style={{background:"var(--surface-2)"}}><option value="">انتخاب شمارهٔ مجازی</option>{numbers.map(n=><option key={n.id} value={n.id} disabled={agents.some(a=>a.vapiPhoneNumberId===n.id&&a.id!==agent)}>{n.number}</option>)}</select>
      <button disabled={busy||!agent||!number} onClick={()=>void assign()} className="workspace-button">اتصال شماره به مشتری</button>
    </div>}
    <details className="rounded-xl border p-3" style={{borderColor:"var(--border)"}}><summary className="cursor-pointer font-semibold">مصرف و تسویهٔ تماس‌ها ({calls.length})</summary><button onClick={()=>void loadCalls()} className="workspace-button secondary my-3">به‌روزرسانی گزارش</button><div className="space-y-3">{calls.map(c=><article key={c.id} className="rounded-xl p-3 text-xs space-y-2" style={{background:"var(--surface-2)"}}><strong>{c.user.name||c.user.email} · {c.agent.name}</strong><p>{c.durationSec??"—"} ثانیه · {c.creditsCharged} کریدت مصرفی · {c.reservedCredits} کریدت رزرو · {c.billingStatus==="settled"?"تسویه‌شده":"در انتظار گزارش"}</p><p dir="ltr" className="break-all">{c.vapiCallId||`Reservation: ${c.id}`}</p>{c.billingStatus!=="settled"&&<button disabled={busy} onClick={()=>void reconcile(c.id)} className="workspace-button secondary">بررسی گزارش و تسویه</button>}</article>)}</div></details>
    <p className="text-xs" style={{color:"var(--text-muted)"}}>مصرف واقعی به نسبت ثانیه و رو به بالا محاسبه می‌شود؛ مبلغ سقف تماس موقتاً رزرو و با گزارش پایان تسویه می‌شود. موجودی Vapi، هزینهٔ شماره و ارتباط تلفنی مستقل از کریدت پلتفرم است.</p>
  </section>;
}
