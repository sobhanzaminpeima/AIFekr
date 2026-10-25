import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { z } from 'zod';
import { request } from '../api';
import type { Locale } from '../i18n';

const inventory = z.object({activeBusinessId:z.string().nullable(),organizations:z.array(z.object({organization:z.object({name:z.string()}),businesses:z.array(z.object({id:z.string(),name:z.string()}))}))});
const copy = {
  fa:{title:'فضای کاری',confirm:'تغییر فضای کاری',body:'این انتخاب فضای کاری حساب شما در وب را هم تغییر می‌دهد.',cancel:'لغو',apply:'تغییر',retry:'دریافت فضاهای کاری',error:'دریافت فضاهای کاری ناموفق بود.'},
  en:{title:'Workspace',confirm:'Switch workspace',body:'This also changes your account’s active workspace on the web.',cancel:'Cancel',apply:'Switch',retry:'Load workspaces',error:'Could not load workspaces.'},
  tr:{title:'Çalışma alanı',confirm:'Çalışma alanını değiştir',body:'Bu seçim web hesabınızdaki etkin çalışma alanını da değiştirir.',cancel:'İptal',apply:'Değiştir',retry:'Çalışma alanlarını yükle',error:'Çalışma alanları yüklenemedi.'},
};
export function WorkspacePicker({locale,onChange,onError,textColor,surface}:{locale:Locale;onChange:()=>void;onError:(error:unknown)=>void;textColor:string;surface:string}) {
  const [items,setItems] = useState<{id:string;name:string}[]>([]); const [selected,setSelected] = useState<string|null>(null);
  const [busy,setBusy] = useState(false); const [failed,setFailed] = useState(false); const [revision,setRevision] = useState(0);
  const t = copy[locale];
  useEffect(()=>{
    let active=true;
    // Discard grants from the previous locale/session while resolving current server grants.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBusy(true); setFailed(false); setItems([]);
    request('/api/organizations',locale).then(raw=>{
      const data=inventory.parse(raw); if(!active)return;
      setSelected(data.activeBusinessId); setItems(data.organizations.flatMap(org=>org.businesses.map(b=>({id:b.id,name:`${org.organization.name} · ${b.name}`}))));
    }).catch(error=>{if(active){setFailed(true);onError(error);}}).finally(()=>{if(active)setBusy(false);});
    return()=>{active=false;};
  },[locale,revision,onError]);
  function choose(id:string) {
    Alert.alert(t.confirm,t.body,[{text:t.cancel,style:'cancel'},{text:t.apply,onPress:()=>{
      setBusy(true);
      request('/api/organizations/context',locale,{method:'PATCH',body:JSON.stringify({businessId:id})}).then(()=>{setSelected(id);onChange();}).catch(onError).finally(()=>setBusy(false));
    }}]);
  }
  return <View style={{gap:8,marginBottom:16}}><Text accessibilityRole="header" style={{color:textColor,fontSize:18,fontWeight:'600',textAlign:locale==='fa'?'right':'left'}}>{t.title}</Text>
    {failed?<Pressable accessibilityRole="button" onPress={()=>setRevision(v=>v+1)} style={{minHeight:48,justifyContent:'center'}}><Text style={{color:textColor}}>{t.retry}</Text></Pressable>:null}
    {items.map(item=><Pressable key={item.id} accessibilityRole="button" accessibilityState={{selected:selected===item.id,disabled:busy}} disabled={busy||selected===item.id} onPress={()=>choose(item.id)} style={{minHeight:48,borderWidth:1,borderRadius:16,padding:12,justifyContent:'center',backgroundColor:surface,borderColor:selected===item.id?'#FF6B00':'#75685A'}}><Text style={{color:textColor,textAlign:locale==='fa'?'right':'left'}}>{item.name}</Text></Pressable>)}
  </View>;
}
