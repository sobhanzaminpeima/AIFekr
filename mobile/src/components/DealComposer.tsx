import {useEffect,useRef,useState} from 'react';
import {StyleSheet,View} from 'react-native';
import {randomUUID} from 'expo-crypto';
import {z} from 'zod';
import {request} from '../api';
import type {Locale} from '../i18n';
import {radius,space} from '../design';
import {AppText,Banner,Button,Field,Row,Sheet} from '../ui/kit';
import {Labeled,Options} from '../ui/forms';
import {useTheme} from '../ui/theme';

const catalog=z.object({pipelines:z.array(z.object({id:z.string(),name:z.string(),stages:z.array(z.object({id:z.string(),name:z.string(),isWon:z.boolean(),isLost:z.boolean()}))}))});
type Deal={id:string;title:string;pipelineId:string;stageId:string};
const copy={fa:{add:'فرصت جدید',title:'فرصت فروش جدید',name:'عنوان فرصت',stage:'مرحله',create:'ثبت فرصت',cancel:'انصراف',hint:'فرصت جدید با مبلغ صفر ثبت می‌شود.',empty:'هنوز پایپلاینی با مرحله در این فضای کاری تعریف نشده.',moveTo:'انتقال به مرحله',preview:'تغییر مرحله ممکن است پیش‌نویس فاکتور و پیگیری داخلی بسازد.',confirm:'تأیید انتقال'},en:{add:'New opportunity',title:'New sales opportunity',name:'Opportunity title',stage:'Stage',create:'Create opportunity',cancel:'Cancel',hint:'New opportunities are recorded with zero value.',empty:'No pipeline with stages exists in this workspace yet.',moveTo:'Move to stage',preview:'Moving a stage may create a draft invoice and internal follow-ups.',confirm:'Confirm move'},tr:{add:'Yeni fırsat',title:'Yeni satış fırsatı',name:'Fırsat başlığı',stage:'Aşama',create:'Fırsat oluştur',cancel:'Vazgeç',hint:'Yeni fırsatlar sıfır değerle kaydedilir.',empty:'Bu alanda henüz aşamalı satış hattı yok.',moveTo:'Aşamaya taşı',preview:'Aşama değişikliği taslak fatura ve dahili takip oluşturabilir.',confirm:'Taşımayı onayla'}};

/** Stage chips for each deal (move asks inline first) and a sheet to open a new opportunity. */
export function DealComposer({contactId,deals,locale,onChanged,onError}:{contactId:string;deals:Deal[];locale:Locale;color?:string;onChanged:()=>void;onError:(e:unknown)=>void}){
 const {c}=useTheme();const t=copy[locale],keys=useRef(new Map<string,string>());
 const [pipelines,setPipelines]=useState<z.infer<typeof catalog>['pipelines']>([]),[stage,setStage]=useState<{pipelineId:string;stageId:string}|null>(null),[title,setTitle]=useState(''),[busy,setBusy]=useState(false),[open,setOpen]=useState(false),[move,setMove]=useState<{deal:Deal;stageId:string;name:string}|null>(null);
 useEffect(()=>{let active=true;request('/api/mobile/v1/crm/catalog',locale).then(raw=>{if(active)setPipelines(catalog.parse(raw).pipelines);}).catch(e=>{if(active)onError(e);});return()=>{active=false;};},[locale,onError]);
 async function mutate(action:'deal.create'|'deal.move',data:unknown,id?:string){if(busy)return;setBusy(true);try{const hash=JSON.stringify({action,data,id,contactId});let key=keys.current.get(hash);if(!key){key=`crm_${randomUUID()}`;keys.current.set(hash,key);}await request('/api/mobile/v1/crm',locale,{method:'POST',body:JSON.stringify({action,data,...(id?{id}:{}),requestKey:key})});keys.current.delete(hash);setTitle('');setOpen(false);setMove(null);onChanged();}catch(e){onError(e);}finally{setBusy(false);}}
 const usable=pipelines.filter(p=>p.stages.length);
 return <View style={{gap:space.md}}>
  {deals.map(deal=>{const stages=pipelines.find(p=>p.id===deal.pipelineId)?.stages??[];if(!stages.length)return null;return <View key={deal.id} style={{gap:space.sm}}>
   <AppText variant="caption" weight="bold" tone="muted">{t.moveTo} · {deal.title}</AppText>
   <Options scroll value={move?.deal.id===deal.id?move.stageId:deal.stageId} disabled={busy} onChange={id=>{if(id!==deal.stageId)setMove({deal,stageId:id,name:stages.find(s=>s.id===id)?.name??''});else setMove(null);}} options={stages.map(s=>({value:s.id,label:s.name}))}/>
   {move?.deal.id===deal.id?<View style={[s.confirm,{backgroundColor:c.soft}]}><AppText variant="caption" tone="softText">{t.preview}</AppText><Row gap={space.sm}><Button style={{flex:1}} label={`${t.confirm}: ${move.name}`} icon="checkmark" busy={busy} onPress={()=>void mutate('deal.move',{stageId:move.stageId},deal.id)}/><Button label={t.cancel} variant="ghost" onPress={()=>setMove(null)}/></Row></View>:null}
  </View>;})}
  <Button label={t.add} icon="add" variant="ghost" disabled={!usable.length} onPress={()=>{setTitle('');setStage(null);setOpen(true);}}/>
  {!usable.length?<AppText variant="caption" tone="muted">{t.empty}</AppText>:null}
  <Sheet visible={open} onClose={()=>setOpen(false)} title={t.title}>
   <Labeled label={t.name}><Field accessibilityLabel={t.name} value={title} onChangeText={setTitle} maxLength={200} editable={!busy}/></Labeled>
   {usable.map(p=><Labeled key={p.id} label={`${t.stage} · ${p.name}`}><Options value={stage?.pipelineId===p.id?stage.stageId:null} disabled={busy} onChange={id=>setStage({pipelineId:p.id,stageId:id})} options={p.stages.filter(x=>!x.isWon&&!x.isLost).map(x=>({value:x.id,label:x.name}))}/></Labeled>)}
   <Banner tone="info" text={t.hint}/>
   <Button label={t.create} icon="checkmark" busy={busy} disabled={!stage||!title.trim()} onPress={()=>void mutate('deal.create',{title,contactId,...stage})}/>
   <Button label={t.cancel} variant="ghost" onPress={()=>setOpen(false)}/>
  </Sheet>
 </View>;
}
const s=StyleSheet.create({confirm:{borderRadius:radius.md,padding:space.md,gap:space.sm}});
