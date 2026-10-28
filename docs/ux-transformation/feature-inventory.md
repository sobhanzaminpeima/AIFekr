# Feature Inventory

Source of truth: `src/lib/navigation/destinations.ts` (68 routes). Workspaces from `src/lib/navigation/workspaces.ts`. Access rules are enforced by each page/API (plan, add-on, account type, admin module switch) and are unchanged.

| Route | Name (fa) | Name (en) | Workspaces | Goal keywords |
|---|---|---|---|---|
| `/home` | خانه | Home | — (All tools) | — |
| `/chat` | گفتگوی هوشمند | AI chat | general | yes |
| `/agents` | ایجنت‌ها | Agents | general | yes |
| `/create` | ساخت محتوا | Create | — (All tools) | — |
| `/crm` | مدیریت مشتری | CRM | real_estate | yes |
| `/sales` | ایجنت فروش | Sales agent | — (All tools) | yes |
| `/voice-agent` | ایجنت صوتی | Voice agent | — (All tools) | yes |
| `/lead-gen` | جذب مشتری | Lead generation | business, real_estate | yes |
| `/seo` | سئو | SEO | business | yes |
| `/seo/sites` | سایت‌های سئو | SEO sites | — (All tools) | — |
| `/seo/agent-pipeline` | گردش کار سئو | SEO workflow | — (All tools) | yes |
| `/social` | شبکه‌های اجتماعی | Social media | business | yes |
| `/website-designer` | طراح وبسایت | Website designer | business | yes |
| `/business-doctor` | دکتر کسب‌وکار | Business doctor | — (All tools) | yes |
| `/ceo` | مشاور مدیرعامل | CEO advisor | — (All tools) | yes |
| `/ceo/orchestrator` | هماهنگی تیم AI | AI team orchestration | — (All tools) | — |
| `/meeting` | اتاق جلسه | Meeting room | — (All tools) | — |
| `/accounting` | حسابداری | Accounting | — (All tools) | yes |
| `/accounting/expenses` | هزینه‌ها | Expenses | — (All tools) | — |
| `/accounting/bank` | حساب‌های بانکی | Bank accounts | — (All tools) | — |
| `/accounting/payroll` | حقوق و دستمزد | Payroll | — (All tools) | — |
| `/accounting/owner-statements` | صورت‌حساب مالکان | Owner statements | — (All tools) | — |
| `/accounting/automation` | خودکارسازی حسابداری | Accounting automation | — (All tools) | — |
| `/accounting/assistant` | دستیار حسابداری | Accounting assistant | — (All tools) | — |
| `/accounting/close-period` | بستن دوره مالی | Close accounting period | — (All tools) | — |
| `/accounting/ledger-setup` | تنظیم دفتر کل | Ledger setup | — (All tools) | — |
| `/student` | فضای دانشجویی | Student workspace | student | yes |
| `/learn` | دوره‌های دانشگاه AIFekr | AIFekr course library | — (All tools) | yes |
| `/student?view=courses&tool=upload` | آپلود جزوه، عکس و ویس دانشجو | Upload student notes, photos or audio | student | yes |
| `/student?view=courses&tool=practice` | آزمون تمرینی دانشجو | Student practice quiz | student | yes |
| `/student?view=courses&tool=review` | مرور و فلش‌کارت دانشجو | Student review and flashcards | student | yes |
| `/student?view=courses&tool=assignment` | کمک به تکلیف دانشجو | Student assignment help | — (All tools) | — |
| `/student?view=planner` | برنامهٔ مطالعه و امتحان | Study planner and exams | — (All tools) | yes |
| `/student?view=groups` | گروه‌های مطالعه | Study groups | — (All tools) | — |
| `/student?view=reports` | زمان‌سنج و گزارش مطالعه | Study timer and reports | — (All tools) | — |
| `/student?view=profile` | کارت و پروفایل دانشجویی | Student card and profile | — (All tools) | — |
| `/student?view=thesis` | پایان‌نامه و پژوهش دانشجو | Student thesis and research | — (All tools) | — |
| `/student/chat` | گفتگوی درسی | Study chat | student | — |
| `/startup/builder` | سازنده استارتاپ | Startup builder | — (All tools) | — |
| `/startup/contact` | مشاوره استارتاپ | Startup consultation | — (All tools) | — |
| `/image/generate` | ساخت تصویر | Generate image | creator | yes |
| `/video/generate` | ساخت ویدیو | Generate video | creator | yes |
| `/fitness` | فیتنس آی‌فکر | AIFekr FIT | fitness | yes |
| `/video-factory` | کارخانه ویدیو | Video factory | creator | yes |
| `/music/generate` | ساخت موسیقی | Generate music | creator | yes |
| `/voice-studio` | استودیوی صدا | Voice Studio | creator | yes |
| `/image/gallery` | ساخته‌های من | My creations | — (All tools) | yes |
| `/gallery` | گالری | Gallery | — (All tools) | — |
| `/industry` | بسته‌های کسب‌وکار | Business packs | real_estate | — |
| `/referral` | دعوت و درآمد | Invite & earn | — (All tools) | — |
| `/plans` | پلن‌ها و اشتراک | Plans & subscriptions | — (All tools) | yes |
| `/credits` | خرید اعتبار | Buy credits | — (All tools) | yes |
| `/payments` | پرداخت‌ها و فعال‌سازی | Payments & activation | — (All tools) | yes |
| `/settings` | تنظیمات | Settings | — (All tools) | yes |
| `/organization/onboarding` | راه‌اندازی کسب‌وکار | Business setup | — (All tools) | — |
| `/tools/business-ideas` | ایده کسب‌وکار | Business ideas | — (All tools) | — |
| `/tools/trading` | تحلیل بازار | Market analysis | — (All tools) | — |
| `/tools/drop-shipping` | دراپشیپینگ | Dropshipping | — (All tools) | — |
| `/tools/math` | حل ریاضی | Math solver | — (All tools) | — |
| `/tools/healthy-diet` | برنامه غذایی | Diet plan | fitness | yes |
| `/tools/try-free-ai` | امتحان AI رایگان | Try free AI | — (All tools) | — |
| `/assistants/teacher` | معلم | Teacher | general | — |
| `/assistants/doctor` | پزشک | Doctor | — (All tools) | — |
| `/assistants/translator` | مترجم | Translator | general | — |
| `/assistants/cooking` | آشپز | Chef | — (All tools) | — |
| `/assistants/fitness-coach` | مربی بدنسازی | Fitness coach | fitness | yes |
| `/assistants/travel-agent` | مشاور سفر | Travel advisor | — (All tools) | — |
| `/assistants/code-expert` | کارشناس کد | Code expert | general | — |
