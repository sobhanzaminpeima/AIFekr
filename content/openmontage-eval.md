# ارزیابی و راه‌اندازی OpenMontage — فاز ۴.۲

**ریپو:** https://github.com/calesthio/OpenMontage
**تصمیم نهایی (۱۸ اوت ۲۰۲۶، طبق دستور سوبهان):** همه‌ی محتوا انگلیسی می‌شود، پس نگرانی RTL/فارسی که در ارزیابی اول باعث رد شدن OpenMontage بود دیگر موضوعیت ندارد. طبق دستور، من (Claude Code) به‌عنوان AI coding assistant مستقیماً از OpenMontage برای مونتاژ استفاده می‌کنم.

---

## وضعیت راه‌اندازی

نصب در `tools/openmontage/` (کلون شده، در `.gitignore` قرار گرفته چون یک نستد گیت‌ریپو با venv/node_modules/.env جداست و بخشی از اپ اصلی AIfekr نیست):

- ✅ Python 3.12 و FFmpeg روی سیستم نصب شدند (با اجازه‌ی صریح شما، از طریق winget)
- ✅ Python venv در `tools/openmontage/.venv` ساخته شد و `requirements.txt` نصب شد
- ✅ `remotion-composer` (موتور رندر React) با `npm install` آماده شد
- ✅ `piper-tts` (TTS رایگان آفلاین) نصب شد
- ✅ فایل `.env` از `.env.example` ساخته شد (خالی — بدون هیچ API key کامیت‌شده)

## چه چیزی بدون API key کار می‌کند؟
طبق مستندات ریپو، بدون هیچ کلید API:
- روایت صوتی (narration) با Piper TTS رایگان
- تصاویر ثابت + انیمیشن با Remotion (نه ویدیوی واقعی تولیدشده)
- فوتیج آرشیوی رایگان از Archive.org / Wikimedia / NASA
- تمام کارهای پس‌تولید (FFmpeg: concat، ساب‌تایتل، میکس صدا)

**برای پایپ‌لاین ما (کلیپ‌های Google Flow که شما دستی دانلود می‌کنید)، به هیچ API key نیازی نیست** — چون خودِ تولید ویدیو بیرون از OpenMontage (در Google Flow) انجام می‌شود؛ OpenMontage فقط نقش مونتاژ/ترکیب را بازی می‌کند (پایپ‌لاین Hybrid: «Source footage + AI-generated support visuals»).

## نحوه‌ی استفاده (مسیر عملیاتی برای پروژه‌ی ما)

1. کلیپ‌های دانلودشده از Google Flow را طبق نام‌گذاری هر بریف (`content/video-prompts/week{N}-{slug}.md`) در پوشه‌ی زیر می‌گذارید:
   ```
   raw-clips/week{N}-{slug}/shot1.mp4, shot2.mp4, ...
   ```
2. من (در همین session یا یک session جدید Claude Code با دسترسی به `tools/openmontage/`) دستور مونتاژ را به OpenMontage می‌دهم — چیزی شبیه:
   > "Using the Hybrid pipeline, assemble the clips in raw-clips/week1-property-status-agent/ in shot order, add the on-screen text and captions from content/video-prompts/week1-property-status-agent.md, mix in upbeat corporate tech background music, and render to content/final-reels/week1-property-status-agent.mp4 at the Instagram Reels profile (1080x1920)."
3. OpenMontage (از طریق من) پایپ‌لاین `research → proposal → script → scene_plan → assets → edit → compose` را طی می‌کند و در نقاط تصمیم خلاقانه (انتخاب موزیک، تایمینگ زیرنویس) از شما تأیید می‌گیرد.
4. خروجی نهایی در `content/final-reels/` قرار می‌گیرد، آماده‌ی آپلود دستی به اینستاگرام.

## محدودیت‌های باقی‌مانده (شفاف)
- OpenMontage برای اجرای کامل به من (یک AI coding assistant) در حلقه نیاز دارد — یک اسکریپت CLI مستقل قابل‌اجرا توسط غیرفنی نیست. طبق دستور شما این پذیرفته شده است.
- بدون API key موزیک/صدا محدود به Piper TTS (صدای رباتیک نسبتاً قابل‌قبول ولی نه استودیویی) و بدون موسیقی تولیدی (Suno/ElevenLabs Music نیاز به کلید دارند) — برای موزیک، از کتابخانه‌ی رایگان (Pexels/Pixabay Audio یا موزیک‌های Royalty-free دستی) استفاده می‌شود مگر کلید API اضافه کنید.
- هیچ کلیپی هنوز واقعاً مونتاژ نشده چون هنوز کلیپ خامی از Google Flow در `raw-clips/` وجود ندارد — این مرحله منتظر شماست: کلیپ‌ها را از Flow بسازید و در `raw-clips/` بگذارید، سپس بگویید کدام هفته را مونتاژ کنم.

## خلاصه
راه‌اندازی کامل و آماده است. منتظر اولین دسته کلیپ خام از Google Flow هستم (پیشنهادم: از هفته ۱، آیتم «Real Estate Specialist Agent» شروع کنید چون بریفش کامل و تأییدشده است) تا اولین مونتاژ واقعی را انجام بدهم.
