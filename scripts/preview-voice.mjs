import {build} from 'esbuild';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
await mkdir('output/voice-preview',{recursive:true});
await build({entryPoints:['scripts/voice-ui-preview.tsx'],outdir:'output/voice-preview',bundle:true,platform:'browser',format:'iife',jsx:'automatic',alias:{'@':path.resolve('src'),'next/link':path.resolve('scripts/voice-preview-link.tsx')},define:{'process.env.NODE_ENV':'"production"'}});
const html=`<!doctype html><html data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/styles/fonts.css"><link rel="stylesheet" href="/src/styles/tokens.css"><link rel="stylesheet" href="/output/voice-preview/voice-ui-preview.css"><style>body{margin:0;background:var(--surface-0,#17191d);color:var(--text-primary,#fff);font-family:Vazirmatn,Arial,sans-serif}*{box-sizing:border-box}</style></head><body><div id="root"></div><script src="/output/voice-preview/voice-ui-preview.js"></script></body></html>`;
await writeFile('output/voice-preview/index.html',html);
http.createServer(async(req,res)=>{try{let target=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(target==='/')target='/output/voice-preview/index.html';if(target.startsWith('/fonts/'))target='/public'+target;const file=path.resolve('.'+target);if(!file.startsWith(process.cwd()+path.sep))throw Error();res.setHeader('Content-Type',file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':file.endsWith('.woff2')?'font/woff2':'text/html');res.end(await readFile(file));}catch{res.statusCode=404;res.end();}}).listen(3057,'127.0.0.1',()=>console.log('Voice UI fixture http://127.0.0.1:3057'));
