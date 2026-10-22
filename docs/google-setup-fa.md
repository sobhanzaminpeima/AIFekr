# تنظیم گوگل برای AIFekr

## Analytics و خطای CMS

سایت Next.js سفارشی است؛ لازم نیست WordPress، Wix یا Shopify انتخاب کنید. پنجرهٔ انتخاب CMS را ببندید و در نصب Google tag گزینهٔ Install manually را انتخاب کنید. آدرس اصلی `https://aifekr.com` است.

- GA4: `G-PEZ7X47VRX` مستقیماً در کد مشترک سایت نصب است.
- GTM: `GTM-5KPJ94DJ` شامل اسکریپت head و noscript بلافاصله در ابتدای body نصب می‌شود.
- در Tag Manager از Preview و آدرس سایت برای Tag Assistant استفاده کنید. تست اتصال موفق به معنی تأیید دریافت در داشبورد Analytics نیست؛ Realtime را هم بررسی کنید.
- فعلاً Google tag دیگری با همان شناسهٔ GA4 داخل GTM نسازید. انتقال GA4 به GTM باید همراه حذف نصب مستقیم انجام شود تا page_view تکراری ثبت نشود. محتویات آیندهٔ کانتینر خارج از کد سایت مدیریت می‌شوند.

## ایندکس و نام برند

۱. در Search Console یک Domain property با نام `aifekr.com` ایجاد و مالکیت را با TXT در DNS تأیید کنید. رکورد دقیق را از همان پنل گوگل بگیرید؛ مقدار فرضی نسازید.

۲. در Sitemaps آدرس `https://aifekr.com/sitemap.xml` را ثبت کنید.

۳. در URL Inspection صفحهٔ اصلی، `/en`، `/ai-chat` و `/en/ai-chat` را بررسی کنید. Test live URL و سپس Request indexing؛ canonical انتخاب‌شدهٔ گوگل باید دامنهٔ اصلی باشد، نه localhost.

۴. نام برند را یکسان استفاده کنید: AIFekr / ای آی فکر. WebSite و Organization دارای alternateName فارسی هستند. این سیگنال پیشنهاد است و نام/رتبه را گوگل انتخاب می‌کند.

## جایگاه در جستجو و AI Overview

جستجوی برند با عبارت عمومی «پلتفرم هوش مصنوعی فارسی» یک هدف نیست. ابتدا ایندکس و نمایش نام برند را بررسی کنید؛ برای عبارت‌های عمومی، صفحات هدف باید مثال واقعی، راهنما و پاسخ مفید داشته باشند. متن تبلیغاتی تکراری و انباشت کلیدواژه جای محتوای مفید را نمی‌گیرد.

- خوشهٔ چت: چت هوش مصنوعی فارسی، دستیار نوشتن متن، AI chat in Persian.
- بیزنس: هوش مصنوعی برای کسب‌وکار، AI tools for small business.
- دانشجویی: دستیار دانشجویی، AI study assistant.
- فیتنس: مربی هوش مصنوعی، AI fitness coach.
- نام و آدرس یکسان در صفحات رسمی و معرفی‌های واقعی سایت‌های دیگر، با لینک معتبر به صفحهٔ مرتبط.
- هر ماه عملکرد فارسی/انگلیسی را در Search Console با impressions، clicks، CTR و صفحات ورودی بررسی کنید؛ وعدهٔ رتبه یا تاریخ ثابت ندهید.

Analytics و GTM ابزار اندازه‌گیری و مدیریت تگ هستند؛ نصبشان تضمین رتبهٔ یک یا حضور در AI Overview نیست. برای AI Overview، قابل‌ایندکس‌بودن، محتوای قابل‌استناد و راهنمای عمومی Google Search اهمیت دارد؛ تگ مخفی یا schema اختصاصیِ تضمینی وجود ندارد.

منابع: [نصب GTM](https://support.google.com/tagmanager/answer/14847097)، [نام سایت](https://developers.google.com/search/docs/appearance/site-names)، [راهنمای گوگل برای امکانات AI](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide).
