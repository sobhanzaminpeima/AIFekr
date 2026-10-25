import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { z } from 'zod';
import { request } from '../api';
import type { Locale } from '../i18n';
import {radius,space} from '../design';
import {AppText,Banner,Icon,Sheet,tap} from '../ui/kit';
import {useTheme} from '../ui/theme';

const inventory = z.object({activeBusinessId:z.string().nullable(),organizations:z.array(z.object({organization:z.object({name:z.string()}),businesses:z.array(z.object({id:z.string(),name:z.string()}))}))});
const copy = {
  fa:{title:'فضای کاری',choose:'انتخاب فضای کاری',body:'این انتخاب، فضای کاری فعال حساب شما در وب را هم تغییر می‌دهد.',retry:'دریافت دوباره',none:'فضای کاری انتخاب نشده'},
  en:{title:'Workspace',choose:'Choose workspace',body:'This also changes your account’s active workspace on the web.',retry:'Retry',none:'No workspace selected'},
  tr:{title:'Çalışma alanı',choose:'Çalışma alanı seç',body:'Bu seçim web hesabınızdaki etkin çalışma alanını da değiştirir.',retry:'Tekrar dene',none:'Çalışma alanı seçilmedi'},
};
/** Current workspace as a compact row; switching happens in a sheet that states the web-wide effect first. */
export function WorkspacePicker({locale,onChange,onError}:{locale:Locale;onChange:()=>void;onError:(error:unknown)=>void}) {
  const {c,rtl}=useTheme();
  const [items,setItems] = useState<{id:string;name:string}[]>([]); const [selected,setSelected] = useState<string|null>(null);
  const [busy,setBusy] = useState(false); const [failed,setFailed] = useState(false); const [revision,setRevision] = useState(0); const [open,setOpen]=useState(false);
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
    setBusy(true);
    request('/api/organizations/context',locale,{method:'PATCH',body:JSON.stringify({businessId:id})}).then(()=>{setSelected(id);setOpen(false);onChange();}).catch(onError).finally(()=>setBusy(false));
  }
  if(!items.length&&!failed)return null;
  const current=items.find(i=>i.id===selected)?.name??t.none;
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={`${t.title}: ${current}`} onPress={()=>{tap();if(failed)setRevision(v=>v+1);else setOpen(true);}} style={({pressed})=>[s.row,{backgroundColor:c.surface,flexDirection:rtl?'row-reverse':'row',opacity:pressed?.85:1}]}>
      <View style={[s.icon,{backgroundColor:c.soft}]}><Icon name="business-outline" size={18} color={c.accent}/></View>
      <View style={{flex:1}}><AppText variant="tiny" tone="muted">{t.title}</AppText><AppText weight="medium" numberOfLines={1}>{failed?t.retry:current}</AppText></View>
      <Icon name={failed?'refresh':'chevron-down'} size={18} color={c.faint}/>
    </Pressable>
    <Sheet visible={open} onClose={()=>setOpen(false)} title={t.choose}>
      <Banner tone="info" text={t.body}/>
      {items.map(item=><Pressable key={item.id} accessibilityRole="radio" accessibilityState={{checked:selected===item.id,disabled:busy}} disabled={busy||selected===item.id} onPress={()=>choose(item.id)} style={[s.option,{backgroundColor:selected===item.id?c.soft:c.raised,flexDirection:rtl?'row-reverse':'row'}]}>
        <Icon name={selected===item.id?'radio-button-on':'radio-button-off'} size={18} color={c.accent}/><AppText style={{flex:1}}>{item.name}</AppText>
      </Pressable>)}
    </Sheet>
  </>;
}
const s=StyleSheet.create({
  row:{alignItems:'center',gap:space.md,borderRadius:radius.lg,padding:space.md},
  icon:{width:36,height:36,borderRadius:12,alignItems:'center',justifyContent:'center'},
  option:{alignItems:'center',gap:space.md,borderRadius:radius.md,padding:space.md},
});
