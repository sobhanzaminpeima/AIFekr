import {useEffect,useState} from 'react';
import {ActivityIndicator,Image,Pressable,ScrollView,Text,View} from 'react-native';
import {z} from 'zod';
import {request} from '../api';
import type {Locale} from '../i18n';
import {MediaComposer} from './MediaComposer';
import {MediaPlayback} from './MediaPlayback';
import {MediaShare} from './MediaShare';
const schema=z.object({items:z.array(z.object({id:z.string(),prompt:z.string(),url:z.string(),credits:z.number(),createdAt:z.string(),refunded:z.boolean().optional()}))});
const copy={fa:{title:'استودیو',image:'تصویر',video:'ویدیو',music:'موسیقی',empty:'تولیدی ذخیره نشده است.',retry:'تلاش مجدد',credits:'اعتبار',refunded:'بازپرداخت شد',pending:'فایل هنوز آماده نیست',notice:'تولید با سرویس متصل و تأیید هزینه؛ وضعیت و سابقه کارها در همین صفحه است.'},en:{title:'Studio',image:'Image',video:'Video',music:'Music',empty:'No saved generations.',retry:'Retry',credits:'credits',refunded:'Refunded',pending:'File is not ready',notice:'Generate with connected providers and cost confirmation; review job status and account gallery here.'},tr:{title:'Stüdyo',image:'Görsel',video:'Video',music:'Müzik',empty:'Kayıtlı üretim yok.',retry:'Tekrar dene',credits:'kredi',refunded:'İade edildi',pending:'Dosya hazır değil',notice:'Bağlı hizmetlerle maliyeti onaylayarak üretin; iş durumunu ve hesap galerisini burada inceleyin.'}};
export function StudioScreen({locale,color,surface,onError}:{locale:Locale;color:string;surface:string;onError:(err:unknown)=>void}){
 const [type,setType]=useState<'image'|'video'|'music'>('image'),[items,setItems]=useState<z.infer<typeof schema>['items']>([]),[busy,setBusy]=useState(true),[revision,setRevision]=useState(0),[failed,setFailed]=useState(false);const t=copy[locale];
 useEffect(()=>{let active=true;
 // Clear the prior media category while resolving its authenticated replacement.
 // eslint-disable-next-line react-hooks/set-state-in-effect
 setBusy(true);setItems([]);setFailed(false);request(`/api/gallery?type=${type}`,locale).then(raw=>{if(active)setItems(schema.parse(raw).items);}).catch(err=>{if(active){setFailed(true);onError(err);}}).finally(()=>{if(active)setBusy(false);});return()=>{active=false;};},[type,locale,revision,onError]);
 return <ScrollView contentContainerStyle={{padding:24,gap:16}}><Text accessibilityRole="header" style={{color,fontSize:30,fontWeight:'700'}}>{t.title}</Text><Text style={{color,textAlign:locale==='fa'?'right':'left'}}>{t.notice}</Text><View style={{flexDirection:locale==='fa'?'row-reverse':'row',gap:8}}>{(['image','video','music'] as const).map(v=><Pressable key={v} accessibilityRole="button" accessibilityState={{selected:type===v}} onPress={()=>setType(v)} style={{minHeight:48,padding:12,borderRadius:16,borderWidth:1,borderColor:type===v?'#FF6B00':'#75685A'}}><Text style={{color}}>{t[v]}</Text></Pressable>)}</View><MediaComposer key={type} type={type} locale={locale} color={color} onError={onError} onGenerated={()=>setRevision(v=>v+1)}/>{busy?<ActivityIndicator color="#FF6B00"/>:null}{failed?<Pressable accessibilityRole="button" onPress={()=>setRevision(v=>v+1)} style={{minHeight:48,justifyContent:'center'}}><Text style={{color}}>{t.retry}</Text></Pressable>:null}{!busy&&!failed&&!items.length?<Text style={{color}}>{t.empty}</Text>:null}{items.map(item=><View key={item.id} style={{backgroundColor:surface,padding:16,borderRadius:20,gap:12}}>{type==='image'&&(/^(https:\/\/|data:image\/)/.test(item.url))?<Image source={{uri:item.url}} accessibilityLabel={item.prompt} style={{width:'100%',height:240,borderRadius:12}}/>:null}{type!=='image'&&/^https:\/\//.test(item.url)?<MediaPlayback url={item.url} type={type} locale={locale} color={color}/>:null}<Text selectable style={{color,textAlign:locale==='fa'?'right':'left'}}>{item.prompt}</Text><Text style={{color}}>{new Intl.NumberFormat(locale).format(item.credits)} {t.credits} · {item.refunded?t.refunded:new Intl.DateTimeFormat(locale,{dateStyle:'short'}).format(new Date(item.createdAt))}</Text><MediaShare url={item.url} type={type} locale={locale} color={color}/>{! /^(https:\/\/|data:image\/)/.test(item.url)?<Text style={{color}}>{t.pending}</Text>:null}</View>)}</ScrollView>;
}



