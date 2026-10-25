import { useEffect,useState } from 'react';
import { Alert,Pressable,Text,View } from 'react-native';
import { z } from 'zod';
import { request } from '../api';
import type { Locale } from '../i18n';
const schema=z.object({sessions:z.array(z.object({id:z.string(),deviceName:z.string(),lastUsedAt:z.string()}))});
const labels={fa:{title:'دستگاه‌های واردشده',remove:'ابطال نشست',all:'ابطال همه نشست‌های موبایل',confirm:'نشست انتخاب‌شده باطل شود؟',cancel:'لغو'},en:{title:'Signed-in devices',remove:'Revoke session',all:'Revoke all mobile sessions',confirm:'Revoke this session?',cancel:'Cancel'},tr:{title:'Oturum açılan cihazlar',remove:'Oturumu iptal et',all:'Tüm mobil oturumları iptal et',confirm:'Bu oturum iptal edilsin mi?',cancel:'İptal'}};
export function DeviceSessions({locale,color,onError}:{locale:Locale;color:string;onError:(err:unknown)=>void}){
 const [sessions,setSessions]=useState<z.infer<typeof schema>['sessions']>([]),[revision,setRevision]=useState(0),[busy,setBusy]=useState(false);const t=labels[locale];
 useEffect(()=>{let active=true;request('/api/mobile/v1/session/devices',locale).then(raw=>{if(active)setSessions(schema.parse(raw).sessions);}).catch(err=>{if(active)onError(err);});return()=>{active=false;};},[locale,revision,onError]);
 function revoke(id?:string){Alert.alert(id?t.confirm:t.all,'',[{text:t.cancel,style:'cancel'},{text:t.remove,style:'destructive',onPress:()=>{setBusy(true);request('/api/mobile/v1/session/devices',locale,{method:'DELETE',body:JSON.stringify(id?{id}:{all:true})}).then(()=>setRevision(v=>v+1)).catch(onError).finally(()=>setBusy(false));}}]);}
 return <View style={{gap:12}}><Text accessibilityRole="header" style={{color,fontWeight:'600',fontSize:20}}>{t.title}</Text>{sessions.map(s=><View key={s.id} style={{gap:8}}><Text style={{color}}>{s.deviceName} · {new Intl.DateTimeFormat(locale,{dateStyle:'short',timeStyle:'short'}).format(new Date(s.lastUsedAt))}</Text><Pressable disabled={busy} accessibilityRole="button" onPress={()=>revoke(s.id)} style={{minHeight:48,justifyContent:'center'}}><Text style={{color}}>{t.remove}</Text></Pressable></View>)}{sessions.length?<Pressable disabled={busy} accessibilityRole="button" onPress={()=>revoke()} style={{minHeight:48,justifyContent:'center'}}><Text style={{color}}>{t.all}</Text></Pressable>:null}</View>;
}
