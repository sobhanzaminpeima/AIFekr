import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Regular user
  const user = await prisma.user.upsert({
    where: { phone: "09000000001" },
    update: {},
    create: {
      phone: "09000000001",
      name: "کاربر تست",
      role: "USER",
      plan: "PRO",
      credits: 9999,
    },
  });
  console.log("✅ User:", user.phone);

  // Admin
  const admin = await prisma.user.upsert({
    where: { phone: "09000000002" },
    update: {},
    create: {
      phone: "09000000002",
      name: "مدیر سیستم",
      role: "ADMIN",
      plan: "PRO",
      credits: 99999,
    },
  });
  console.log("✅ Admin:", admin.phone);

  // Super Admin
  const superAdmin = await prisma.user.upsert({
    where: { phone: "09000000000" },
    update: {},
    create: {
      phone: "09000000000",
      name: "سوپر ادمین",
      role: "SUPER_ADMIN",
      plan: "PRO",
      credits: 999999,
    },
  });
  console.log("✅ Super Admin:", superAdmin.phone);

  // Default prompts
  const prompts = [
    { id: "p1", title: "ایده کسب‌وکار", content: "یک ایده کسب‌وکار آنلاین با سرمایه کم برای من پیشنهاد بده", category: "کسب‌وکار", sortOrder: 1 },
    { id: "p2", title: "توضیح ساده", content: "این مفهوم را به زبان ساده توضیح بده:", category: "آموزش", sortOrder: 2 },
    { id: "p3", title: "برنامه غذایی", content: "یک برنامه غذایی سالم هفتگی برایم بنویس", category: "سلامت", sortOrder: 3 },
    { id: "p4", title: "کد پایتون", content: "یک اسکریپت پایتون برای [هدف] بنویس", category: "فناوری", sortOrder: 4 },
    { id: "p5", title: "ترجمه متن", content: "این متن را به فارسی روان ترجمه کن:", category: "عمومی", sortOrder: 5 },
    { id: "p6", title: "خلاصه مقاله", content: "این مقاله را در ۵ نکته کلیدی خلاصه کن:", category: "آموزش", sortOrder: 6 },
  ];

  for (const p of prompts) {
    await prisma.prompt.upsert({ where: { id: p.id }, update: {}, create: p });
  }
  console.log("✅ Prompts seeded");

  // Industry Packs
  const INDUSTRY_PACKS = [
    {
      slug: "construction", name: "ساخت‌وساز", emoji: "🏗️",
      tagline: "تیم هوش مصنوعی مدیریت ساخت‌وساز شما",
      valueProposition: "پروژه‌ها را به‌موقع تحویل دهید، هزینه‌ها را کنترل کنید و قراردادهای بیشتری ببرید — همه با عوامل AI که ۲۴/۷ کار می‌کنند.",
      targetCustomers: JSON.stringify(["شرکت‌های ساختمانی", "پیمانکاران عمومی", "توسعه‌دهندگان املاک", "سازندگان و پیمانکاران فرعی"]),
      painPoints: JSON.stringify(["تأخیر پروژه که هزاران تومان در روز هزینه دارد", "هزینه‌های تأمین و مواد بدون کنترل", "خط لوله ضعیف سرنخ و پیگیری فروش", "عدم دید لحظه‌ای از پیشرفت پروژه", "گزارش‌گیری دستی که هر هفته ساعت‌ها وقت می‌گیرد"]),
      agents: JSON.stringify([
        { slug: "project-manager", name: "مدیر پروژه هوش مصنوعی", role: "MANAGER", description: "نقاط عطف را پیگیری می‌کند، تأخیرها را اعلام و ذی‌نفعان را به‌طور خودکار به‌روز می‌کند", icon: "📋" },
        { slug: "procurement-manager", name: "مدیر تأمین هوش مصنوعی", role: "SPECIALIST", description: "قیمت تأمین‌کنندگان را مقایسه می‌کند، سفارش‌های خرید را مدیریت و تحویل مواد را پیگیری می‌کند", icon: "🛒" },
        { slug: "cost-controller", name: "کنترل‌کننده هزینه هوش مصنوعی", role: "SPECIALIST", description: "بودجه را در برابر هزینه واقعی پایش می‌کند، تجاوزها را اعلام و هزینه نهایی را پیش‌بینی می‌کند", icon: "💰" },
        { slug: "sales-agent", name: "عامل فروش هوش مصنوعی", role: "SPECIALIST", description: "سرنخ‌های ساخت‌وساز را ارزیابی می‌کند، پیشنهاد ارسال و به‌طور خودکار پیگیری می‌کند", icon: "🤝" },
        { slug: "crm-agent", name: "عامل CRM هوش مصنوعی", role: "WORKER", description: "روابط مشتری را مدیریت و تاریخچه ارتباطات را پیگیری می‌کند", icon: "📞" },
        { slug: "marketing-agent", name: "عامل بازاریابی هوش مصنوعی", role: "WORKER", description: "نمایش پروژه، پست لینکدین و محتوای قبل/بعد می‌سازد", icon: "📣" },
        { slug: "ceo-assistant", name: "دستیار مدیرعامل هوش مصنوعی", role: "CEO", description: "سلامت پورتفولیو پروژه و تصمیمات استراتژیک را ترکیب می‌کند", icon: "👑" },
      ]),
      outcomes: JSON.stringify([{ metric: "۳۰٪ کاهش تأخیر", description: "AI هر نقطه عطف را پایش و زود هشدار می‌دهد" }, { metric: "۱۵٪ صرفه‌جویی هزینه", description: "تأمین بهتر و تشخیص زودهنگام تجاوز هزینه" }, { metric: "۳ برابر سرنخ بیشتر", description: "خط لوله خودکار ارتباط و پیگیری" }, { metric: "۱۰ ساعت/هفته صرفه‌جویی", description: "گزارش‌گیری و به‌روزرسانی خودکار" }]),
      kpis: JSON.stringify(["پروژه‌های فعال", "نرخ به‌موقع بودن", "اختلاف بودجه", "سرنخ‌های جدید", "پیشنهادهای ارسالی", "نرخ برد"]),
      tier: "professional", price: 299, color: "#F59E0B", gradientFrom: "#78350F", gradientTo: "#B45309", sortOrder: 1,
    },
    {
      slug: "real-estate", name: "املاک", emoji: "🏠",
      tagline: "نیروی فروش املاک هوش مصنوعی شما",
      valueProposition: "سرنخ‌های واجد شرایط بیشتری تولید کنید، معاملات را سریع‌تر ببندید و با ۸ عامل AI بدون وقفه بر بازار محلی خود مسلط شوید.",
      targetCustomers: JSON.stringify(["آژانس‌های املاک", "توسعه‌دهندگان املاک", "مشاوران و نمایندگان", "شرکت‌های مدیریت املاک"]),
      painPoints: JSON.stringify(["تولید سرنخ ناپایدار از ماهی به ماه دیگر", "پیگیری کند باعث سرد شدن سرنخ‌ها می‌شود", "زمان کافی برای محتوای بازاریابی ملک نیست", "اطلاعات CRM قدیمی و ناقص است", "دیده‌شدن ضعیف در گوگل و شبکه‌های اجتماعی"]),
      agents: JSON.stringify([
        { slug: "lead-hunter", name: "شکارچی سرنخ هوش مصنوعی", role: "SPECIALIST", description: "سرنخ‌های خریدار و فروشنده را از شبکه‌های اجتماعی، وب و پورتال‌ها ۲۴/۷ پیدا می‌کند", icon: "🎯" },
        { slug: "sales-agent", name: "عامل فروش هوش مصنوعی", role: "SPECIALIST", description: "سرنخ‌ها را ارزیابی می‌کند، بازدید برنامه‌ریزی و پیشنهاد شخصی‌سازی شده ارسال می‌کند", icon: "🤝" },
        { slug: "crm-agent", name: "عامل CRM هوش مصنوعی", role: "WORKER", description: "هر مخاطب را به‌روز نگه می‌دارد، یادآوری پیگیری خودکار است", icon: "📇" },
        { slug: "property-marketing", name: "بازاریابی ملک هوش مصنوعی", role: "SPECIALIST", description: "توضیحات آگهی، پست شبکه اجتماعی و کمپین ایمیل برای هر ملک می‌سازد", icon: "📸" },
        { slug: "call-center", name: "مرکز تماس هوش مصنوعی", role: "SPECIALIST", description: "به تماس‌های ورودی پاسخ می‌دهد، تماس‌گیرنده‌ها را ارزیابی و قرار ملاقات رزرو می‌کند", icon: "📞" },
        { slug: "seo-agent", name: "عامل سئو هوش مصنوعی", role: "SPECIALIST", description: "وب‌سایت آژانس و آگهی‌های ملک را برای جستجوی گوگل بهینه می‌کند", icon: "🔍" },
        { slug: "social-agent", name: "عامل شبکه اجتماعی هوش مصنوعی", role: "WORKER", description: "محتوای روزانه ملک را در اینستاگرام، فیسبوک و لینکدین منتشر می‌کند", icon: "📱" },
        { slug: "ceo-assistant", name: "دستیار مدیرعامل هوش مصنوعی", role: "CEO", description: "بررسی هفتگی عملکرد کسب‌وکار و استراتژی رشد ۹۰ روزه", icon: "👑" },
      ]),
      outcomes: JSON.stringify([{ metric: "۵ برابر سرنخ بیشتر", description: "جستجوی چندکاناله AI هرگز متوقف نمی‌شود" }, { metric: "۶۰٪ پیگیری سریع‌تر", description: "AI در کمتر از ۶۰ ثانیه به سؤالات پاسخ می‌دهد" }, { metric: "۴۰٪ آگهی بیشتر", description: "تولید محتوا در مقیاس بزرگ فروشندگان را جذب می‌کند" }, { metric: "رتبه ۳ برتر گوگل", description: "سئوی هوش مصنوعی برای جستجوی محلی ملک" }]),
      kpis: JSON.stringify(["سرنخ‌های جدید", "بازدیدهای رزرو شده", "آگهی‌های فعال", "معاملات بسته شده", "میانگین روز در بازار", "درآمد"]),
      tier: "professional", price: 299, color: "#3B82F6", gradientFrom: "#1E3A5F", gradientTo: "#1D4ED8", sortOrder: 2,
    },
    {
      slug: "clinic", name: "کلینیک پزشکی", emoji: "🏥",
      tagline: "مدیر مطب پزشکی هوش مصنوعی شما",
      valueProposition: "تقویم نوبت‌دهی خود را پر کنید، عدم حضور را کاهش دهید و نظرات بیماران را رشد دهید — درحالی‌که کارکنانتان روی درمان تمرکز می‌کنند.",
      targetCustomers: JSON.stringify(["کلینیک‌های پزشکی", "کلینیک‌های دندان‌پزشکی", "پزشکان متخصص", "مراکز فیزیوتراپی"]),
      painPoints: JSON.stringify(["نوبت‌های خالی که ظرفیت کلینیک را هدر می‌دهد", "نرخ بالای عدم حضور بدون یادآوری", "نظرات منفی بدون مدیریت", "بودجه بازاریابی هدررفته در کانال‌های نادرست", "کارکنان پذیرش غرق در تماس‌ها"]),
      agents: JSON.stringify([
        { slug: "receptionist", name: "منشی هوش مصنوعی", role: "SPECIALIST", description: "به تماس‌ها پاسخ می‌دهد، نوبت رزرو و سؤالات را ۲۴/۷ مدیریت می‌کند", icon: "🗓️" },
        { slug: "appointment-agent", name: "عامل نوبت‌دهی هوش مصنوعی", role: "WORKER", description: "یادآوری ارسال می‌کند، عدم حضور را کاهش و لغوها را مدیریت می‌کند", icon: "⏰" },
        { slug: "call-center", name: "مرکز تماس هوش مصنوعی", role: "SPECIALIST", description: "تماس‌های پیگیری بیمار و چک‌این بعد از ویزیت را مدیریت می‌کند", icon: "📞" },
        { slug: "marketing-agent", name: "عامل بازاریابی هوش مصنوعی", role: "SPECIALIST", description: "محتوای سلامت، کمپین فصلی و پست آموزش بیمار می‌سازد", icon: "📣" },
        { slug: "crm-agent", name: "عامل CRM هوش مصنوعی", role: "WORKER", description: "تاریخچه بیمار، تناوب ویزیت و بازگشت مجدد را پیگیری می‌کند", icon: "📋" },
        { slug: "reputation-manager", name: "مدیر اعتبار هوش مصنوعی", role: "SPECIALIST", description: "نظرات گوگل و پلتفرم‌های سلامت را پایش و پاسخ می‌دهد", icon: "⭐" },
        { slug: "ceo-assistant", name: "دستیار مدیرعامل هوش مصنوعی", role: "CEO", description: "گزارش ماهانه عملکرد کلینیک و توصیه‌های رشد", icon: "👑" },
      ]),
      outcomes: JSON.stringify([{ metric: "۴۰٪ کاهش عدم حضور", description: "یادآوری چندکاناله خودکار نوبت" }, { metric: "۲ برابر بیمار جدید", description: "بازاریابی و مدیریت اعتبار هوش مصنوعی" }, { metric: "میانگین امتیاز ۴.۸ ستاره", description: "جمع‌آوری و پاسخ فعال نظرات" }, { metric: "صرفه‌جویی ۲ نیروی تمام‌وقت", description: "منشی AI ۸۰٪ تماس‌های ورودی را مدیریت می‌کند" }]),
      kpis: JSON.stringify(["نوبت‌های امروز", "نرخ عدم حضور", "بیماران جدید", "امتیاز گوگل", "درآمد ماهانه", "نگه‌داشت بیمار"]),
      tier: "professional", price: 299, color: "#10B981", gradientFrom: "#064E3B", gradientTo: "#047857", sortOrder: 3,
    },
    {
      slug: "restaurant", name: "رستوران", emoji: "🍽️",
      tagline: "تیم عملیات رستوران هوش مصنوعی شما",
      valueProposition: "میزهای بیشتری پر کنید، اعتبار آنلاین خود را در دست بگیرید و با تیم AI که هرگز نمی‌خوابد مشتریان وفادار رشد دهید.",
      targetCustomers: JSON.stringify(["رستوران‌ها", "کافه و قهوه‌خانه", "آشپزخانه‌های ابری", "شرکت‌های پذیرایی"]),
      painPoints: JSON.stringify(["رزرو میز ناپایدار و ساعات خلوت خالی", "نظرات منفی آسیب‌زننده به اعتبار آنلاین", "بودجه‌ای برای تیم کامل بازاریابی نیست", "نرخ پایین بازگشت مشتری", "پست دستی شبکه اجتماعی وقت‌گیر است"]),
      agents: JSON.stringify([
        { slug: "reservation-agent", name: "عامل رزرو هوش مصنوعی", role: "SPECIALIST", description: "رزرو آنلاین و تلفنی را مدیریت می‌کند، دسترسی میز را کنترل می‌کند", icon: "🪑" },
        { slug: "marketing-agent", name: "عامل بازاریابی هوش مصنوعی", role: "SPECIALIST", description: "کمپین تبلیغاتی، پیشنهاد ویژه و اعلان رویداد می‌سازد", icon: "📣" },
        { slug: "social-agent", name: "عامل شبکه اجتماعی هوش مصنوعی", role: "WORKER", description: "توضیحات روزانه عکس غذا، استوری، هشتگ و تعامل می‌سازد", icon: "📱" },
        { slug: "review-manager", name: "مدیر نظرات هوش مصنوعی", role: "SPECIALIST", description: "گوگل، تریپ‌ادوایزر و زوماتو را پایش و به هر نظر پاسخ می‌دهد", icon: "⭐" },
        { slug: "crm-agent", name: "عامل CRM هوش مصنوعی", role: "WORKER", description: "مشتریان ثابت، کمپین تولد و مدیریت برنامه وفاداری را پیگیری می‌کند", icon: "❤️" },
        { slug: "ceo-assistant", name: "دستیار مدیرعامل هوش مصنوعی", role: "CEO", description: "تحلیل هفتگی درآمد و عملکرد منو", icon: "👑" },
      ]),
      outcomes: JSON.stringify([{ metric: "۳۰٪ مهمان بیشتر", description: "AI با تبلیغات هدفمند ساعات خلوت را پر می‌کند" }, { metric: "امتیاز ۴.۷ ستاره", description: "هر نظر در کمتر از ۲ ساعت پاسخ داده می‌شود" }, { metric: "۲۵٪ نرخ بازگشت", description: "کمپین وفاداری مشتریان را برمی‌گرداند" }, { metric: "حضور روزانه شبکه اجتماعی", description: "محتوا هر روز بدون زحمت منتشر می‌شود" }]),
      kpis: JSON.stringify(["رزروهای امروز", "درصد اشغال میز", "امتیاز گوگل", "مشتریان بازگشتی", "دسترسی شبکه اجتماعی", "درآمد هفتگی"]),
      tier: "professional", price: 299, color: "#EF4444", gradientFrom: "#7F1D1D", gradientTo: "#B91C1C", sortOrder: 4,
    },
    {
      slug: "university", name: "دانشگاه / مدرسه", emoji: "🎓",
      tagline: "تیم عملیات آموزشی هوش مصنوعی شما",
      valueProposition: "ثبت‌نام را افزایش دهید، از دانشجویان ۲۴/۷ پشتیبانی کنید و حجم کار اداری را با AI آموزشی تخصصی خودکار کنید.",
      targetCustomers: JSON.stringify(["دانشگاه‌های خصوصی", "مؤسسات آموزشی", "مدارس", "پلتفرم‌های دوره آنلاین"]),
      painPoints: JSON.stringify(["ثبت‌نام پایین و خط لوله کند جذب دانشجو", "دانشجویان خارج از ساعات اداری پاسخی نمی‌گیرند", "بودجه بازاریابی با بازده ضعیف", "کارکنان اداری غرق در سؤالات تکراری", "بدون داده در مورد ریسک ترک تحصیل"]),
      agents: JSON.stringify([
        { slug: "admissions-agent", name: "عامل پذیرش هوش مصنوعی", role: "SPECIALIST", description: "دانشجویان بالقوه را ارزیابی می‌کند، جلسه معرفی رزرو و پیگیری می‌کند", icon: "🎯" },
        { slug: "student-advisor", name: "مشاور دانشجویی هوش مصنوعی", role: "SPECIALIST", description: "به سؤالات دانشجویان درباره دوره‌ها، شهریه و برنامه ۲۴/۷ پاسخ می‌دهد", icon: "💬" },
        { slug: "call-center", name: "مرکز تماس هوش مصنوعی", role: "SPECIALIST", description: "تماس‌های ورودی برای پذیرش و پشتیبانی دانشجو را مدیریت می‌کند", icon: "📞" },
        { slug: "marketing-agent", name: "عامل بازاریابی هوش مصنوعی", role: "SPECIALIST", description: "کمپین ثبت‌نام، تبلیغ روز باز و محتوای نظرات می‌سازد", icon: "📣" },
        { slug: "crm-agent", name: "عامل CRM هوش مصنوعی", role: "WORKER", description: "دانشجویان بالقوه و فعلی را در طول چرخه زندگی پیگیری می‌کند", icon: "📋" },
        { slug: "research-assistant", name: "دستیار پژوهشی هوش مصنوعی", role: "WORKER", description: "مقالات را خلاصه می‌کند، به اساتید در مرور ادبیات کمک می‌کند", icon: "📚" },
        { slug: "ceo-assistant", name: "دستیار مدیرعامل هوش مصنوعی", role: "CEO", description: "تحلیل روند ثبت‌نام و داشبورد عملکرد مؤسسه", icon: "👑" },
      ]),
      outcomes: JSON.stringify([{ metric: "۳ برابر سرنخ ثبت‌نام", description: "خط لوله پذیرش AI ۲۴/۷ فعال است" }, { metric: "۸۰٪ خودکارسازی پاسخ", description: "مشاور دانشجویی AI سؤالات تکراری را مدیریت می‌کند" }, { metric: "۵۰٪ صرفه‌جویی هزینه اداری", description: "زمان‌بندی، یادآوری و پیگیری خودکار" }, { metric: "نگه‌داشت بالاتر", description: "تشخیص و مداخله زودهنگام ریسک ترک تحصیل" }]),
      kpis: JSON.stringify(["دانشجویان بالقوه", "درخواست‌های دریافتی", "نرخ ثبت‌نام", "رضایت دانشجو", "زمان پاسخ به سؤال", "نرخ نگه‌داشت"]),
      tier: "gold", price: 999, color: "#8B5CF6", gradientFrom: "#2E1065", gradientTo: "#6D28D9", sortOrder: 5,
    },
    {
      slug: "ecommerce", name: "فروشگاه آنلاین", emoji: "🛒",
      tagline: "موتور رشد فروشگاه آنلاین هوش مصنوعی شما",
      valueProposition: "درآمد را مقیاس‌پذیر کنید، رهاسازی سبد خرید را کاهش دهید و بر گوگل شاپینگ مسلط شوید — با تیم AI که فروشگاه شما را ۲۴/۷ بهینه می‌کند.",
      targetCustomers: JSON.stringify(["فروشگاه‌های آنلاین", "برندهای D2C", "کسب‌وکارهای دراپ‌شیپینگ", "فروشندگان آمازون/نون"]),
      painPoints: JSON.stringify(["رهاسازی بالای سبد خرید بدون پیگیری", "رتبه‌بندی ضعیف سئو در گوگل و بازارها", "افزایش هزینه تبلیغات با کاهش بازده", "زمان کافی برای حجم پشتیبانی مشتری نیست", "تصمیمات محصول و قیمت‌گذاری بدون داده"]),
      agents: JSON.stringify([
        { slug: "product-manager", name: "مدیر محصول هوش مصنوعی", role: "MANAGER", description: "پرفروش‌ها را تحلیل می‌کند، کم‌فروش‌ها را اعلام و تغییر قیمت پیشنهاد می‌کند", icon: "📦" },
        { slug: "ads-agent", name: "عامل تبلیغات هوش مصنوعی", role: "SPECIALIST", description: "کمپین‌های تبلیغاتی گوگل و متا را مدیریت و بازده را روزانه بهینه می‌کند", icon: "📊" },
        { slug: "seo-agent", name: "عامل سئو هوش مصنوعی", role: "SPECIALIST", description: "عنوان، توضیحات و صفحات دسته محصول را برای جستجو بهینه می‌کند", icon: "🔍" },
        { slug: "customer-support", name: "پشتیبانی مشتری هوش مصنوعی", role: "SPECIALIST", description: "بازگشت کالا، سؤالات، وضعیت سفارش و شکایات را فوراً مدیریت می‌کند", icon: "💬" },
        { slug: "crm-agent", name: "عامل CRM هوش مصنوعی", role: "WORKER", description: "بازیابی سبد رهاشده، کمپین خرید مجدد و تقسیم‌بندی VIP", icon: "❤️" },
        { slug: "sales-agent", name: "عامل فروش هوش مصنوعی", role: "SPECIALIST", description: "پیشنهاد فروش مکمل و ارتقا از طریق ایمیل و چت", icon: "🤝" },
        { slug: "ceo-assistant", name: "دستیار مدیرعامل هوش مصنوعی", role: "CEO", description: "گزارش هفتگی هوش درآمد و استراتژی رشد", icon: "👑" },
      ]),
      outcomes: JSON.stringify([{ metric: "۲۵٪ درآمد بیشتر", description: "بازیابی سبد خرید و فروش مکمل خودکار AI" }, { metric: "۳ برابر ترافیک ارگانیک", description: "سئوی هوش مصنوعی برای هر صفحه محصول" }, { metric: "۶۰٪ پشتیبانی سریع‌تر", description: "AI فوراً ۸۰٪ سؤالات مشتری را مدیریت می‌کند" }, { metric: "بازده تبلیغات بالاتر", description: "بهینه‌سازی روزانه تبلیغات توسط AI" }]),
      kpis: JSON.stringify(["سفارش روزانه", "درآمد", "نرخ رهاسازی سبد", "بازده تبلیغات", "ترافیک ارگانیک", "رضایت پشتیبانی مشتری"]),
      tier: "professional", price: 299, color: "#F97316", gradientFrom: "#7C2D12", gradientTo: "#C2410C", sortOrder: 6,
    },
    {
      slug: "law-firm", name: "دفتر وکالت", emoji: "⚖️",
      tagline: "تیم رشد عملیات حقوقی هوش مصنوعی شما",
      valueProposition: "درخواست‌های مشاوره بیشتری تبدیل کنید، پذیرش موکل را به‌طور خودکار مدیریت و اعتبار آنلاین دفتر خود را رشد دهید.",
      targetCustomers: JSON.stringify(["دفاتر وکالت", "وکلای مستقل", "مشاوران حقوقی", "دفاتر اسناد رسمی"]),
      painPoints: JSON.stringify(["پاسخ کند یا ازدست‌رفته به درخواست‌های مشاوره", "زمان هدررفته در امور اداری و پذیرش غیرقابل‌صورت‌حساب", "دیده‌شدن آنلاین پایین در بازار رقابتی حقوقی", "ارتباط و پیگیری ناپایدار با موکل", "بدون سیستم پیگیری سرنخ و نرخ تبدیل"]),
      agents: JSON.stringify([
        { slug: "intake-agent", name: "عامل پذیرش هوش مصنوعی", role: "SPECIALIST", description: "سؤالات موکلین جدید را ارزیابی می‌کند، جزئیات پرونده را جمع‌آوری و مشاوره رزرو می‌کند", icon: "📝" },
        { slug: "crm-agent", name: "عامل CRM هوش مصنوعی", role: "WORKER", description: "تمام تعاملات موکل، مهلت‌ها و پیگیری‌ها را پیگیری می‌کند", icon: "📋" },
        { slug: "document-assistant", name: "دستیار اسناد هوش مصنوعی", role: "SPECIALIST", description: "نامه‌های استاندارد، توافق محرمانگی، قرارداد و خلاصه حقوقی تنظیم می‌کند", icon: "📄" },
        { slug: "marketing-agent", name: "عامل بازاریابی هوش مصنوعی", role: "SPECIALIST", description: "مقالات حقوقی، رهبری فکری لینکدین و پست مطالعه موردی می‌سازد", icon: "📣" },
        { slug: "call-center", name: "مرکز تماس هوش مصنوعی", role: "SPECIALIST", description: "به تماس‌های ورودی پاسخ می‌دهد، تماس‌گیرنده‌ها را پیش‌ارزیابی و به وکیل مناسب هدایت می‌کند", icon: "📞" },
        { slug: "seo-agent", name: "عامل سئو هوش مصنوعی", role: "WORKER", description: "وب‌سایت دفتر را برای کلمات کلیدی حوزه فعالیت و جستجوی محلی بهینه می‌کند", icon: "🔍" },
        { slug: "ceo-assistant", name: "دستیار مدیرعامل هوش مصنوعی", role: "CEO", description: "بررسی ماهانه عملکرد دفتر، سلامت خط لوله، پیش‌بینی درآمد", icon: "👑" },
      ]),
      outcomes: JSON.stringify([{ metric: "۳ برابر رزرو مشاوره", description: "پذیرش AI هرگز سؤال موکل جدید را از دست نمی‌دهد" }, { metric: "۵ ساعت/هفته صرفه‌جویی هر وکیل", description: "AI اسناد روتین و به‌روزرسانی موکل را تنظیم می‌کند" }, { metric: "رتبه ۵ برتر محلی گوگل", description: "سئوی AI برای حوزه فعالیت + جستجوی شهر" }, { metric: "۹۰٪ نرخ پاسخ سرنخ", description: "هر سؤال در کمتر از ۵ دقیقه پاسخ داده می‌شود" }]),
      kpis: JSON.stringify(["سؤالات جدید", "مشاوره‌های رزرو شده", "پرونده‌های برده", "ساعات قابل‌صورت‌حساب", "رتبه گوگل", "درآمد ماهانه"]),
      tier: "gold", price: 999, color: "#6366F1", gradientFrom: "#1E1B4B", gradientTo: "#4338CA", sortOrder: 7,
    },
    {
      slug: "hotel", name: "هتل / مهمان‌نوازی", emoji: "🏨",
      tagline: "تیم درآمد و تجربه مهمان هتل هوش مصنوعی شما",
      valueProposition: "اشغال را به حداکثر برسانید، ارتباط با مهمان را خودکار کنید و با عوامل مهمان‌نوازی AI اعتبار آنلاین ۵ ستاره بسازید.",
      targetCustomers: JSON.stringify(["هتل‌ها", "اقامتگاه‌های بوتیک", "آپارتمان‌های خدماتی", "املاک استراحتگاهی"]),
      painPoints: JSON.stringify(["رزرو مستقیم پایین — وابستگی زیاد به OTAها", "پاسخ کند به سؤالات و نظرات مهمان", "بدون فروش مکمل شخصی‌سازی شده یا برنامه وفاداری", "هزینه بالای کارکنان پذیرش و کنسیرژ", "مدیریت ضعیف اعتبار آنلاین"]),
      agents: JSON.stringify([
        { slug: "booking-agent", name: "عامل رزرو هوش مصنوعی", role: "SPECIALIST", description: "سؤالات رزرو مستقیم، بررسی دسترسی و تأیید را مدیریت می‌کند", icon: "🗓️" },
        { slug: "guest-experience", name: "عامل تجربه مهمان هوش مصنوعی", role: "SPECIALIST", description: "پیام پیش از ورود، درخواست حین اقامت، پیگیری بعد از خروج", icon: "🛎️" },
        { slug: "call-center", name: "مرکز تماس هوش مصنوعی", role: "SPECIALIST", description: "به سؤالات تلفنی پاسخ می‌دهد، درخواست‌ها را مدیریت و به دپارتمان‌ها هدایت می‌کند", icon: "📞" },
        { slug: "reputation-manager", name: "مدیر اعتبار هوش مصنوعی", role: "SPECIALIST", description: "بوکینگ، تریپ‌ادوایزر و گوگل را پایش و به نظرات پاسخ می‌دهد", icon: "⭐" },
        { slug: "marketing-agent", name: "عامل بازاریابی هوش مصنوعی", role: "SPECIALIST", description: "بسته‌های فصلی، فروش فوری و کمپین وفاداری می‌سازد", icon: "📣" },
        { slug: "revenue-manager", name: "مدیر درآمد هوش مصنوعی", role: "WORKER", description: "قیمت‌گذاری رقبا را پایش و تنظیم نرخ پویا پیشنهاد می‌دهد", icon: "💰" },
        { slug: "ceo-assistant", name: "دستیار مدیرعامل هوش مصنوعی", role: "CEO", description: "تحلیل هفتگی RevPAR، پیش‌بینی اشغال و بررسی استراتژی", icon: "👑" },
      ]),
      outcomes: JSON.stringify([{ metric: "۲۰٪ رزرو مستقیم بیشتر", description: "AI بازدیدکنندگان وب‌سایت را به مهمان مستقیم تبدیل می‌کند" }, { metric: "۴.۹ ستاره در همه پلتفرم‌ها", description: "هر نظر در کمتر از ۱ ساعت پاسخ داده می‌شود" }, { metric: "۱۵٪ نرخ متوسط روزانه بالاتر", description: "AI ارتقا و بسته‌ها را به هر مهمان پیشنهاد می‌دهد" }, { metric: "صرفه‌جویی ۱ نیروی تمام‌وقت", description: "AI ۷۰٪ سؤالات پذیرش را مدیریت می‌کند" }]),
      kpis: JSON.stringify(["نرخ اشغال", "RevPAR", "درصد رزرو مستقیم", "امتیاز مهمان", "نرخ پاسخ نظرات", "نرخ متوسط روزانه"]),
      tier: "gold", price: 999, color: "#14B8A6", gradientFrom: "#042F2E", gradientTo: "#0F766E", sortOrder: 8,
    },
  ];

  for (const pack of INDUSTRY_PACKS) {
    await prisma.industryPack.upsert({
      where: { slug: pack.slug },
      update: { ...pack },
      create: { ...pack, isActive: true },
    });
  }
  console.log("✅ Industry Packs seeded (8 packs)");

  console.log("\n📋 اطلاعات ورود:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("👤 کاربر:        09000000001 → کد: 1234");
  console.log("🛡️  ادمین:        09000000002 → کد: 1234");
  console.log("⚡ سوپر ادمین:   09000000000 → کد: 1234");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
