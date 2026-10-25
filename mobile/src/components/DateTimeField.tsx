import {useState} from 'react';
import {Platform,Pressable,Text,View} from 'react-native';
import DateTimePicker,{DateTimePickerAndroid} from '@react-native-community/datetimepicker';
import type {Locale} from '../i18n';
export function DateTimeField({value,onChange,locale,color,disabled=false}:{value:Date;onChange:(date:Date)=>void;locale:Locale;color:string;disabled?:boolean}){
 const [mode,setMode]=useState<'date'|'time'|null>(null);const labels={fa:{date:'انتخاب تاریخ',time:'انتخاب ساعت',close:'بستن'},en:{date:'Choose date',time:'Choose time',close:'Close'},tr:{date:'Tarih seç',time:'Saat seç',close:'Kapat'}}[locale];
 function open(next:'date'|'time'){if(Platform.OS==='android')DateTimePickerAndroid.open({value,mode:next,is24Hour:true,onValueChange:(_event,date)=>onChange(date)});else setMode(next);}
 return <View style={{gap:8}}><Text style={{color,textAlign:locale==='fa'?'right':'left'}}>{new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short'}).format(value)}</Text><View style={{flexDirection:locale==='fa'?'row-reverse':'row',gap:12}}>{(['date','time'] as const).map(next=><Pressable key={next} accessibilityRole="button" disabled={disabled} onPress={()=>open(next)} style={{minHeight:48,padding:12,justifyContent:'center'}}><Text style={{color}}>{labels[next]}</Text></Pressable>)}</View>{mode?<><DateTimePicker value={value} mode={mode} display="spinner" onValueChange={(_event,date)=>onChange(date)} onDismiss={()=>setMode(null)}/><Pressable accessibilityRole="button" onPress={()=>setMode(null)} style={{minHeight:48,padding:12}}><Text style={{color}}>{labels.close}</Text></Pressable></>:null}</View>;
}
