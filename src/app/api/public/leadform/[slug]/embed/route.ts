export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

/**
 * Serves a tiny loader script a tenant pastes into its own website:
 *   <script src="https://aifekr.com/api/public/leadform/<slug>/embed" async></script>
 * It injects a floating button that opens /f/<slug> in an overlay iframe.
 * UTM params present on the host page are forwarded to the form.
 */
export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  const form = await prisma.leadForm.findUnique({ where: { slug: params.slug }, select: { slug: true, isActive: true, accentColor: true, submitLabel: true } });
  if (!form || !form.isActive) {
    return new NextResponse("/* lead form not found */", { status: 404, headers: { "Content-Type": "application/javascript" } });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://aifekr.com";
  const label = (form.submitLabel || "تماس با ما").replace(/[<>"'\\]/g, "");
  const accent = /^#[0-9a-fA-F]{6}$/.test(form.accentColor) ? form.accentColor : "#ea580c";

  const js = `(function(){
  var SLUG=${JSON.stringify(form.slug)},BASE=${JSON.stringify(appUrl)},ACCENT=${JSON.stringify(accent)},LABEL=${JSON.stringify(label)};
  if(document.getElementById('aifekr-lf-'+SLUG))return;
  var qs=window.location.search||"";
  var btn=document.createElement('button');
  btn.id='aifekr-lf-'+SLUG;
  btn.textContent=LABEL;
  btn.style.cssText='position:fixed;z-index:2147483000;bottom:20px;inset-inline-end:20px;background:'+ACCENT+';color:#fff;border:0;border-radius:999px;padding:12px 22px;font:600 15px system-ui,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.25);cursor:pointer';
  var wrap=document.createElement('div');
  wrap.style.cssText='position:fixed;inset:0;z-index:2147483001;background:rgba(0,0,0,.55);display:none;align-items:center;justify-content:center;padding:16px';
  var frame=document.createElement('iframe');
  frame.src=BASE+'/f/'+SLUG+qs+(qs?'&':'?')+'embed=1';
  frame.style.cssText='width:100%;max-width:440px;height:min(620px,90vh);border:0;border-radius:16px;background:#fff;box-shadow:0 20px 60px rgba(0,0,0,.4)';
  var close=document.createElement('button');
  close.textContent='\u00d7';
  close.style.cssText='position:absolute;top:14px;inset-inline-end:18px;background:#fff;color:#111;border:0;border-radius:999px;width:34px;height:34px;font-size:20px;cursor:pointer';
  wrap.appendChild(frame);wrap.appendChild(close);
  function open(){wrap.style.display='flex';}
  function hide(){wrap.style.display='none';}
  btn.addEventListener('click',open);close.addEventListener('click',hide);
  wrap.addEventListener('click',function(e){if(e.target===wrap)hide();});
  window.addEventListener('message',function(e){if(e.data==='aifekr-leadform-submitted'){setTimeout(hide,1600);}});
  document.body.appendChild(btn);document.body.appendChild(wrap);
})();`;

  return new NextResponse(js, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
