// Builds a local review artifact from the real React components and CSS.
import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
const root=process.cwd();
const compiled=await build({entryPoints:['scripts/ui-foundation-preview.tsx'],bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'}});
let fonts=await readFile('src/styles/fonts.css','utf8');
for(const match of fonts.matchAll(/url\((\/fonts\/[^)]+)\)/g)){
 const data=await readFile(path.join('public',match[1]));fonts=fonts.replace(match[1],`data:font/woff2;base64,${data.toString('base64')}`);
}
const globals=await postcss([tailwindcss('./tailwind.config.ts')]).process(await readFile('src/app/globals.css','utf8'),{from:'src/app/globals.css'});
const css=[fonts,await readFile('src/styles/tokens.css','utf8'),globals.css,await readFile('src/styles/foundation.css','utf8')].join('\n');
const previewCss=`.preview{max-width:1100px;margin:auto;padding:40px 24px;font-family:var(--font-body);line-height:var(--leading-body)}.preview-heading{display:flex;justify-content:space-between;gap:24px;align-items:center;flex-wrap:wrap}.preview h1{font-size:var(--text-3xl);font-weight:700;margin:6px 0}.preview h2{font-size:var(--text-lg);font-weight:600;margin:0 0 24px}.preview-heading p,.preview-note{color:var(--text-secondary)}.preview-kicker{font:500 12px Inter,sans-serif;letter-spacing:.12em;color:var(--accent)!important}.preview-note{margin:24px 0;font-size:var(--text-sm)}.preview-controls{display:flex;align-items:end;gap:12px;flex-wrap:wrap}.preview-controls label{font-size:var(--text-sm)}.preview-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}.preview-stack{display:grid;gap:20px}.preview-actions{display:flex;flex-wrap:wrap;gap:12px;align-items:center}.preview-statuses{margin-top:24px}.preview-feedback{color:var(--success);font-size:var(--text-sm);margin-top:20px}.preview-type{margin-top:20px}.preview-sample{font-size:var(--text-2xl);font-weight:600;margin-bottom:12px}.preview-numbers{color:var(--text-secondary)}.preview-swatches{display:flex;gap:8px;margin-top:24px}.preview-swatches span{height:36px;flex:1;border:1px solid var(--border);border-radius:8px}@media(max-width:640px){.preview{padding:24px 16px}.preview-grid{grid-template-columns:1fr}.preview .ui-panel{padding:20px}.preview h1{font-size:var(--text-2xl)}}`;
await mkdir('docs/uiux',{recursive:true});
await writeFile('docs/uiux/foundation-preview.html',`<!doctype html><html lang="fa" dir="rtl" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AiFekr — Design foundation</title><style>${css}\n${previewCss}</style></head><body><div id="preview-root"></div><script>${compiled.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')}</script></body></html>`);
console.log('Preview: docs/uiux/foundation-preview.html');
