// Read-only audit of AIFekr's public surface. No authenticated or paid requests.
const fs = require('node:fs');
const base = process.env.SEO_AUDIT_BASE || 'https://aifekr.com';
const output = process.env.SEO_AUDIT_OUTPUT || 'analysis/uiux-audit/seo-live-before.json';
const allowed = ['aifekr.com', 'localhost', '127.0.0.1'];
if (!allowed.includes(new URL(base).hostname)) throw Error('Use AIFekr or localhost');
const decode = s => s.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'");
const attrs = s => Object.fromEntries([...s.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map(m=>[m[1].toLowerCase(),decode(m[2]??m[3])]));
const sameUrl = (a,b) => { try { return new URL(a).href === new URL(b).href; } catch { return false; } };
const text = s => decode(s.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim());
async function read(url) {
  const start=performance.now();
  try { const r=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(30000)});return {status:r.status,headers:Object.fromEntries(r.headers),ms:Math.round(performance.now()-start),html:await r.text()}; }
  catch(e){return {status:0,error:e.message,ms:Math.round(performance.now()-start),headers:{},html:''};}
}
async function main(){
  const sitemap=await read(base+'/sitemap.xml'), robots=await read(base+'/robots.txt');
  const urls=[...sitemap.html.matchAll(/<loc>(.*?)<\/loc>/g)].map(m=>decode(m[1]));
  const rows=[], queue=[...new Set(urls)];
  const origin=new URL(base).origin;
  async function worker(){while(queue.length){const canonicalUrl=queue.shift();const path=new URL(canonicalUrl).pathname;const target=origin+path;const r=await read(target);const clean=r.html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'');const links=[...clean.matchAll(/<link\b([^>]*)>/gi)].map(m=>attrs(m[1]));const meta=[...clean.matchAll(/<meta\b([^>]*)>/gi)].map(m=>attrs(m[1]));const find=name=>meta.filter(m=>m.name===name||m.property===name).map(m=>m.content);const headings=[...clean.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map(m=>text(m[1]));const title=text(clean.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'');const canonical=links.filter(m=>m.rel==='canonical').map(m=>m.href);const alternates=Object.fromEntries(links.filter(m=>m.hreflang).map(m=>[m.hreflang,m.href]));const jsonld=[...r.html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>{try{return JSON.parse(m[1])}catch{return {invalid:true}}});const internal=[...new Set([...clean.matchAll(/<a\b([^>]*)>/gi)].map(m=>attrs(m[1]).href).filter(Boolean).map(h=>{try{const u=new URL(h,canonicalUrl);return u.origin===new URL(canonicalUrl).origin?u.pathname:null}catch{return null}}).filter(Boolean))];const images=[...clean.matchAll(/<img\b([^>]*)>/gi)].map(m=>attrs(m[1]));const main=clean.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1]||'';const row={url:canonicalUrl,path,status:r.status,ms:r.ms,htmlBytes:Buffer.byteLength(r.html),title,descriptions:find('description'),canonical,lang:attrs(clean.match(/<html\b([^>]*)>/i)?.[1]||'').lang,robots:find('robots'),h1:headings,alternates,ogImage:find('og:image'),jsonld,mainTextChars:text(main).length,internal,missingImageAlt:images.filter(i=>!Object.hasOwn(i,'alt')).length,issues:[]};
  if(r.status!==200)row.issues.push('HTTP_'+r.status);if(canonical.length!==1||!sameUrl(canonical[0],canonicalUrl))row.issues.push('canonical');if(!title)row.issues.push('title_missing');if(row.descriptions.length!==1||!row.descriptions[0])row.issues.push('description');if(headings.length!==1)row.issues.push('h1_count');if(row.robots.some(s=>/noindex/i.test(s)))row.issues.push('noindex_public');if(row.missingImageAlt)row.issues.push('image_alt');if(!Object.values(alternates).some(url=>sameUrl(url,canonicalUrl)))row.issues.push('hreflang_self');if(jsonld.some(s=>s.invalid))row.issues.push('jsonld_invalid');rows.push(row);}}
  await Promise.all([worker(),worker(),worker()]);rows.sort((a,b)=>a.url.localeCompare(b.url));
  const duplicates=key=>{const groups=new Map();for(const r of rows){const value=key==='title'?r.title:r.descriptions[0];if(value){const list=groups.get(value)||[];list.push(r.path);groups.set(value,list)}}return [...groups].filter(([,v])=>v.length>1).map(([value,paths])=>({value,paths}));};
  const variants=[];for(const url of ['http://aifekr.com/','https://www.aifekr.com/','http://www.aifekr.com/',base+'/pricing/',base+'/fa/pricing',base+'/definitely-not-a-real-page-seo-qa']){const r=await read(url);variants.push({url,status:r.status,location:r.headers.location,error:r.error});}
  const missingAlternates=rows.flatMap(r=>Object.entries(r.alternates).filter(([,url])=>!urls.some(target=>sameUrl(url,target))).map(([lang,url])=>({path:r.path,lang,url})));
  const report={auditedAt:new Date().toISOString(),base,sitemap:{status:sitemap.status,count:urls.length,unique:new Set(urls).size},robots:{status:robots.status,text:robots.html},variants,duplicates:{title:duplicates('title'),description:duplicates('description')},missingAlternates,rows};
  fs.writeFileSync(output,JSON.stringify(report,null,2));console.log(JSON.stringify({pages:rows.length,problemPages:rows.filter(r=>r.issues.length).map(r=>({path:r.path,issues:r.issues})),duplicates:report.duplicates,variants,missingAlternates},null,2));
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
