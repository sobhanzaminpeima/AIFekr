import {createContext,useContext} from 'react';
import {palettes,type Palette} from '../design';
import type {Locale} from '../i18n';

export type Theme={c:Palette;dark:boolean;locale:Locale;rtl:boolean};
const ThemeContext=createContext<Theme>({c:palettes.dark,dark:true,locale:'fa',rtl:true});
export const ThemeProvider=ThemeContext.Provider;
export const useTheme=()=>useContext(ThemeContext);
export const numberFormat=(locale:Locale,value:number)=>new Intl.NumberFormat(locale==='fa'?'fa-IR':locale).format(value);
