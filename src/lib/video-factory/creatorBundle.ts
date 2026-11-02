import {packageSchema} from '@/lib/billing/plans';
/** Owner-approved offer: 5 narrated one-minute videos, 500 credits, 30-day term. */
export const creatorBundle=packageSchema.parse({
 planCode:'VF_CREATOR_5',name:'پکیج تولید محتوا؛ ۵ ویدیوی یک‌دقیقه‌ای',nameEn:'Creator Pack · 5 one-minute videos',
 description:'۵ ویدیوی حداکثر ۶۰ ثانیه، سناریوی هوش مصنوعی آی‌فکر و گویندگی چندزبانه؛ ۵۰۰ کردیت. قیمت قبل از تخفیف ۷٬۰۰۰٬۰۰۰ تومان، قیمت ویژه ۴٬۲۵۰٬۰۰۰ تومان.',
 category:'VIDEO_FACTORY',baseCurrency:'IRT',termPrices:{monthly:4250000},price:42500000,credits:500,duration:30,
 publicationStatus:'PUBLISHED',publicVisible:true,isActive:true,isFeatured:true,market:'IR',badge:'۳۹٪ تخفیف',sortOrder:1,
 entitlements:{modules:['video-factory'],limits:{videoCount:5,videoSeconds:300,videoMaxSeconds:60,creatorBundle:1,compareAtToman:7000000},fixedPrices:{IRT:{monthly:4250000}}},
 features:'۵ ویدیو، هر کدام حداکثر ۶۰ ثانیه\nسناریونویسی توسط هوش مصنوعی آی‌فکر\nتصاویر و انیمیشن صحنه‌ها\nگویندگی چندزبانه\n۵۰۰ کردیت؛ حداکثر ۱۰۰ کردیت برای هر ویدیو\nبازگشت کردیت در شکست فنی\nاعتبار پکیج ۳۰ روز',
 featuresEn:'5 videos, up to 60 seconds each\nAIFekr AI scriptwriting\nImages and scene animation\nMultilingual narration\n500 credits; at most 100 per video\nCredit refund for technical failure\n30-day package'
});
