import type {ReactNode} from 'react';
import {Pressable,ScrollView,StyleSheet,View} from 'react-native';
import {fonts,radius,space,type} from '../design';
import {AppText,tap} from './kit';
import {useTheme} from './theme';

/** Single-choice chips (radio group). Replaces the old "● / ○" text buttons. */
export function Options<T extends string>({value,options,onChange,disabled,scroll}:{value:T|null;options:readonly {value:T;label:string}[];onChange:(v:T)=>void;disabled?:boolean;scroll?:boolean}){
 const {c,rtl}=useTheme();
 const chips=options.map(o=>{const on=o.value===value;return <Pressable key={o.value} accessibilityRole="radio" accessibilityState={{checked:on,disabled:!!disabled}} disabled={disabled} onPress={()=>{tap();onChange(o.value);}} style={[s.chip,{backgroundColor:on?c.accent:c.raised,opacity:disabled?.5:1}]}>
  <AppText variant="caption" weight="medium" style={{color:on?c.onAccent:c.text,fontFamily:fonts.medium}} align="center">{o.label}</AppText>
 </Pressable>;});
 if(scroll&&!rtl)return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:space.sm,flexDirection:rtl?'row-reverse':'row',paddingVertical:2}}>{chips}</ScrollView>;
 return <View accessibilityRole="radiogroup" style={{flexDirection:rtl?'row-reverse':'row',flexWrap:'wrap',gap:space.sm}}>{chips}</View>;
}

export function Labeled({label,children,hint}:{label:string;children:ReactNode;hint?:string}){
 return <View style={{gap:6}}><AppText variant="caption" weight="medium" tone="muted">{label}</AppText>{children}{hint?<AppText variant="tiny" tone="faint">{hint}</AppText>:null}</View>;
}

/** Section tabs for the Business screen. They wrap instead of scrolling: horizontal
 * scroll in RTL starts at the wrong end on some platforms and hides the selected tab. */
export function SectionTabs<T extends string>({value,tabs,onChange}:{value:T;tabs:readonly {value:T;label:string}[];onChange:(v:T)=>void}){
 const {c,rtl}=useTheme();
 return <View accessibilityRole="tablist" style={{gap:space.sm,flexDirection:rtl?'row-reverse':'row',flexWrap:'wrap'}}>
  {tabs.map(tab=>{const on=tab.value===value;return <Pressable key={tab.value} accessibilityRole="tab" accessibilityState={{selected:on}} onPress={()=>{tap();onChange(tab.value);}} style={[s.tab,{backgroundColor:on?c.accent:c.surface}]}>
   <AppText variant="caption" weight="medium" style={[type.caption,{fontFamily:fonts.medium,color:on?c.onAccent:c.muted}]}>{tab.label}</AppText>
  </Pressable>;})}
 </View>;
}

/** Initials avatar for contacts and people. */
export function Initials({name,size=40}:{name:string;size?:number}){
 const {c}=useTheme();
 // Arabic-script letters join when placed together, so Persian names get a single letter.
 const words=name.trim().split(/\s+/);const letters=(/[؀-ۿ]/.test(name)?words[0]?.[0]:words.slice(0,2).map(p=>p[0]).join(''))?.toUpperCase()||'?';
 return <View style={{width:size,height:size,borderRadius:size/2,backgroundColor:c.soft,alignItems:'center',justifyContent:'center'}}><AppText weight="bold" tone="softText" align="center" style={{fontSize:size*.36,lineHeight:size*.5}}>{letters}</AppText></View>;
}

const s=StyleSheet.create({
 chip:{borderRadius:radius.pill,paddingHorizontal:space.md,paddingVertical:8,minHeight:36,justifyContent:'center'},
 tab:{borderRadius:radius.pill,paddingHorizontal:space.lg,paddingVertical:8,minHeight:38,justifyContent:'center'},
});
