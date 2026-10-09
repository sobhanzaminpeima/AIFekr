"""Generate the approved bilingual Telnyx knowledge PDF (ReportLab)."""
from pathlib import Path
import json, html
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle, KeepTogether
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
ROOT=Path(__file__).resolve().parents[1]
# A bundled licensed font handles Turkish and currency characters on every host.
pdfmetrics.registerFont(TTFont('KB',str(ROOT/'public/fonts/Vazirmatn-Regular.ttf')))
pdfmetrics.registerFontFamily('KB',normal='KB',bold='KB',italic='KB',boldItalic='KB')
W,H=A4
ink=colors.HexColor('#18312f');orange=colors.HexColor('#e66825');muted=colors.HexColor('#5b6d6b')
body=ParagraphStyle('Body',fontName='KB',fontSize=10.1,leading=15.1,textColor=ink,spaceAfter=9)
small=ParagraphStyle('Small',parent=body,fontSize=8.2,leading=11.5,textColor=muted)
title=ParagraphStyle('Title',parent=body,fontSize=22,leading=28,spaceAfter=8)
sub=ParagraphStyle('Sub',parent=body,fontSize=13,leading=18,textColor=muted,spaceAfter=14)
lang=ParagraphStyle('Lang',parent=body,fontSize=9.7,leading=14,textColor=orange,spaceBefore=8,spaceAfter=7)
sections=json.loads((ROOT/'docs/telnyx/knowledge-base.json').read_text())
out=ROOT/'output/pdf/AIFekr-Telnyx-Knowledge-Base-EN-TR.pdf';out.parent.mkdir(parents=True,exist_ok=True)
story=[]
def p(text,style=body):return Paragraph(html.escape(text),style)
def footer(canvas,doc):
 canvas.saveState();canvas.setFillColor(orange);canvas.rect(46,H-36,38,3,fill=1,stroke=0)
 canvas.setFont('KB',8);canvas.setFillColor(muted);canvas.drawString(46,H-53,'AIFekr / TELNYX KNOWLEDGE BASE / EN + TR')
 canvas.setStrokeColor(colors.HexColor('#d7e1df'));canvas.line(46,43,W-46,43)
 canvas.drawString(46,28,'Product reference • 9 October 2026 • support@aifekr.com');canvas.drawRightString(W-46,28,str(doc.page));canvas.restoreState()
story.extend([Spacer(1,92),p('AIFekr',ParagraphStyle('Brand',parent=title,fontSize=46,leading=56,textColor=orange)),p('Knowledge Base',ParagraphStyle('CoverTitle',parent=title,fontSize=31,leading=38)),p('Bilgi Tabanı',ParagraphStyle('CoverTR',parent=title,fontSize=25,leading=33)),Spacer(1,20),p('English + Türkçe',sub),p('A complete platform reference for the Telnyx AI support assistant.'),p('Telnyx yapay zekâ destek asistanı için kapsamlı platform rehberi.'),Spacer(1,26),p('33 bilingual topics • Account, pricing, student, business and support workflows',sub),p('Prepared: 9 October 2026'),p('Website: https://aifekr.com'),p('Support: support@aifekr.com'),Spacer(1,22),p('TRY student prices are fixed base amounts. USD and Toman equivalents follow current reference rates. A PDF cannot refresh itself daily; use checkout or a live pricing tool for current converted amounts.',small),p('Öğrenci TRY fiyatları sabit temel tutarlardır. USD ve Toman güncel referans kura bağlıdır. PDF günlük yenilenmez; güncel karşılık için ödeme ekranını veya canlı fiyat aracını kullanın.',small),PageBreak()])
story += [p('Contents / İçindekiler',title),p('Every topic includes English and Turkish. / Her konu iki dilde sunulur.',small),Spacer(1,8)]
for i,s in enumerate(sections,1):
 story.append(Paragraph(f'<link href="#topic{i}" color="#18312f">{i:02d} · {html.escape(s["en_title"])}</link>',ParagraphStyle('TOC',parent=body,fontSize=10.1,leading=15.9,spaceAfter=2)))
story += [Spacer(1,12),p('Sources and maintenance / Kaynaklar ve güncelleme',small),PageBreak()]
for i,s in enumerate(sections,1):
 story += [Paragraph(f'<a name="topic{i}"/>{i:02d} / {html.escape(s["en_title"])}',title),p(s['tr_title'],sub)]
 if s['route']:story += [p('AIFekr routes / Yollar: '+s['route'],small)]
 story += [p('ENGLISH',lang)]
 for block in s['en'].split('\n'):story.append(p(block))
 story += [p('TÜRKÇE',lang)]
 for block in s['tr'].split('\n'):story.append(p(block))
 story.append(PageBreak())
story += [p('Sources and maintenance',title),p('Kaynaklar ve güncelleme',sub),p('Product basis / Ürün kaynağı',lang),p('Repository routes and components, existing platform knowledge documents, Student Academy documentation, commerce/SEO/voice documentation and the requested release changes were compared. Historical conflicting statements were checked against implementation. No private customer records or credentials are included.'),p('Depo kodu, mevcut platform bilgi belgeleri, Öğrenci Akademisi belgeleri, ticaret/SEO/ses belgeleri ve istenen sürüm değişiklikleri karşılaştırıldı. Eski çelişkili ifadeler uygulamayla kontrol edildi. Özel müşteri kaydı veya erişim bilgisi eklenmedi.'),p('Public references / Açık kaynaklar',lang)]
refs=[('AIFekr platform','https://aifekr.com'),('Pricing / Fiyatlar','https://aifekr.com/pricing'),('Terms / Koşullar','https://aifekr.com/terms'),('Privacy / Gizlilik','https://aifekr.com/privacy'),('Google OpenID Connect reference','https://developers.google.com/identity/openid-connect/reference'),('Telnyx PDF embedding documentation','https://developers.telnyx.com/api/inference/inference-embedding/post-embedding'),('Telnyx portal knowledge uploads','https://telnyx.com/release-notes/fast-knowledge-base-uploads'),('Reference FX feed','https://open.er-api.com/v6/latest/USD')]
for label,url in refs:
 story.append(p(label,body));story.append(Paragraph(f'<link href="{url}" color="#e66825">{html.escape(url)}</link>',small))
story += [Spacer(1,14),p('Maintenance owner: AIFekr support. Replace obsolete uploaded versions when products, prices or policies change. Live account state and current exchange quotes require authorized tools.',small),p('Güncelleme sorumlusu: AIFekr destek. Ürün, fiyat veya politika değişince eski yüklemeyi değiştirin. Canlı hesap durumu ve güncel kur yetkili araç gerektirir.',small)]
SimpleDocTemplate(str(out),pagesize=A4,rightMargin=46,leftMargin=46,topMargin=70,bottomMargin=60,title='AIFekr Knowledge Base - English and Turkish',author='AIFekr',subject='Telnyx AI support knowledge').build(story,onFirstPage=footer,onLaterPages=footer)
print(out)
