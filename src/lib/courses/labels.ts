import {tri} from "@/lib/i18n/tri";
import type {Lang} from "@/lib/i18n";
export function difficultyLabel(level:string,lang:Lang){
 return level==='BEGINNER'?tri(lang,'مقدماتی','Beginner','Anfänger','Başlangıç'):level==='INTERMEDIATE'?tri(lang,'متوسط','Intermediate','Mittelstufe','Orta'):level==='ADVANCED'?tri(lang,'پیشرفته','Advanced','Fortgeschritten','İleri'):level;
}
export function courseLanguageLabel(language:string){return ({fa:'فارسی',en:'English',de:'Deutsch',tr:'Türkçe'} as Record<string,string>)[language]||language;}
