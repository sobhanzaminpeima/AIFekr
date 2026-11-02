import type {Lang} from '@/lib/i18n/server';
export const PACKAGE_CATEGORIES=[
 {code:'CHAT_STARTER',landing:true,labels:{fa:'چت هوش مصنوعی',en:'AI Chat',de:'KI-Chat',tr:'AI Sohbet'}},
 {code:'BUSINESS',landing:true,labels:{fa:'بیزنس',en:'Business',de:'Business',tr:'İşletme'}},
 {code:'STUDENT',landing:true,labels:{fa:'دانشجویی',en:'Student',de:'Studium',tr:'Öğrenci'}},
 {code:'FITNESS',landing:true,labels:{fa:'فیتنس',en:'Fitness',de:'Fitness',tr:'Fitness'}},
 {code:'VIDEO_FACTORY',landing:true,labels:{fa:'تولید محتوا',en:'Content creation',de:'Inhaltserstellung',tr:'İçerik üretimi'}},
 {code:'PERSONAL',landing:false,labels:{fa:'شخصی',en:'Personal',de:'Persönlich',tr:'Kişisel'}},
 {code:'ENTERPRISE',landing:false,labels:{fa:'سازمانی',en:'Enterprise',de:'Unternehmen',tr:'Kurumsal'}},
] as const;
export const LANDING_PACKAGE_CATEGORIES=PACKAGE_CATEGORIES.filter(c=>c.landing).map(c=>c.code);
export function packageCategoryLabels(lang:Lang):Record<string,string>{return Object.fromEntries(PACKAGE_CATEGORIES.map(c=>[c.code,c.labels[lang]]));}
/** Superseded by the current chat tiers; existing paid snapshots remain valid. */
export const RETIRED_PUBLIC_PLAN_CODES=['CHAT_STARTER_30'];
