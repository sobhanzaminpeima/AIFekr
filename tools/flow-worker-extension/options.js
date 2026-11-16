const fields=['token','projectUrl','maxCredits','enabled'];
const form=document.getElementById('form'),status=document.getElementById('status');
let workerId;
const check=document.createElement('button');
check.type='button';check.textContent='بررسی اتصال بدون تولید';
form.after(check);
check.addEventListener('click',async()=>{
  check.disabled=true;status.textContent='در حال بررسی اتصال ذخیره‌شده…';
  const labels={TOKEN_REQUIRED:'ابتدا کلید اختصاصی Worker را ذخیره کنید.',
    CONNECTED_DISABLED_SAFE:'اتصال سرور و تب Flow برقرار است؛ هیچ سفارشی دریافت یا تولید نشد.',
    OPEN_CONFIGURED_FLOW_PROJECT:'سرور متصل است؛ دقیقاً یک تب با آدرس پروژهٔ ذخیره‌شده باز کنید.',
    PROTOCOL_MISMATCH:'نسخهٔ سرور با افزونه سازگار نیست.',
    CONNECTION_FAILED:'اتصال تأیید نشد؛ کلید ذخیره‌شده و آماده بودن سرور را بررسی کنید.'};
  try{const result=await chrome.runtime.sendMessage({action:'health'});status.textContent=labels[result?.code] || labels.CONNECTION_FAILED;}
  catch{status.textContent=labels.CONNECTION_FAILED;}
  finally{check.disabled=false;}
});
(async()=>{
  const data=await chrome.storage.local.get(['settings','status']);workerId=data.settings?.workerId || crypto.randomUUID();
  for(const key of fields){const el=document.getElementById(key);if(key==='enabled')el.checked=data.settings?.enabled || false;else el.value=data.settings?.[key] ?? (key==='maxCredits'?0:'');}
  status.textContent=data.status?.code || 'غیرفعال — اتصال هنوز آزمایش نشده';
})();
form.addEventListener('submit',async event=>{
  event.preventDefault();
  const value=Object.fromEntries(fields.map(key=>[key,key==='enabled'?document.getElementById(key).checked:document.getElementById(key).value]));
  try{const url=new URL(value.projectUrl);if(url.origin!=='https://flow.google.com' || !/^\/project\/[a-zA-Z0-9-]+$/.test(url.pathname) || url.search || url.hash)throw Error();}catch{status.textContent='آدرس دقیق پروژهٔ Flow معتبر نیست.';return;}
  await chrome.storage.local.set({settings:{...value,workerId,maxCredits:Number(value.maxCredits)}});
  status.textContent='ذخیره شد';await chrome.runtime.sendMessage({action:'tick'});
});
