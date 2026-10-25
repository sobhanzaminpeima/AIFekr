import {useState} from 'react';
import {ActivityIndicator,StyleSheet,View} from 'react-native';
import {z} from 'zod';
import {ApiError,request} from '../api';
import type {Locale} from '../i18n';
import {radius,space} from '../design';
import {AppText,Card,Chip,Icon,Row,type IconName} from '../ui/kit';
import {useTheme} from '../ui/theme';

const schema=z.object({tool:z.enum(['recentContacts','followUpsDue']),generatedAt:z.string().datetime(),data:z.object({contacts:z.array(z.object({id:z.string(),name:z.string(),status:z.string()})).optional(),tasks:z.array(z.object({id:z.string(),title:z.string(),dueDate:z.string().nullable()})).optional()})});
type Tool=z.infer<typeof schema>['tool'];
const copy={
 fa:{title:'نگاه سریع به کسب‌وکار',free:'رایگان',tools:{recentContacts:['مشتری‌های جدید','۲۴ ساعت گذشته'],followUpsDue:['پیگیری‌های امروز','سررسیده یا عقب‌افتاده']},empty:{recentContacts:'امروز مشتری جدیدی ثبت نشده.',followUpsDue:'پیگیری عقب‌افتاده‌ای نداری.'},updated:'به‌روز در',due:'سررسید',locked:'این بخش با بستهٔ کسب‌وکار فعال می‌شود.'},
 en:{title:'Business at a glance',free:'Free',tools:{recentContacts:['New contacts','Last 24 hours'],followUpsDue:["Today's follow-ups",'Due or overdue']},empty:{recentContacts:'No new contacts today.',followUpsDue:'Nothing overdue.'},updated:'Updated',due:'Due',locked:'Available with a business plan.'},
 tr:{title:'İşe hızlı bakış',free:'Ücretsiz',tools:{recentContacts:['Yeni kişiler','Son 24 saat'],followUpsDue:['Bugünkü takipler','Vadesi gelmiş']},empty:{recentContacts:'Bugün yeni kişi yok.',followUpsDue:'Geciken takip yok.'},updated:'Güncellendi',due:'Vade',locked:'İş paketiyle kullanılabilir.'},
} as const;
const icons:Record<Tool,IconName>={recentContacts:'people-outline',followUpsDue:'alarm-outline'};

/** Read-only workspace lookups; they never call an AI model, so they cost nothing. */
export function FikaBusinessTools({locale,onError}:{locale:Locale;onError:(error:unknown)=>void}){
 const {c,rtl}=useTheme();const t=copy[locale];
 const [result,setResult]=useState<z.infer<typeof schema>|null>(null),[busy,setBusy]=useState<Tool|null>(null),[locked,setLocked]=useState(false);
 async function load(tool:Tool){if(busy)return;setBusy(tool);try{setResult(schema.parse(await request(`/api/mobile/v1/fika/tools?tool=${tool}`,locale)));}catch(error){if(error instanceof ApiError&&(error.status===402||error.status===403))setLocked(true);else onError(error);}finally{setBusy(null);}}
 const time=(iso:string,opts:Intl.DateTimeFormatOptions)=>new Intl.DateTimeFormat(locale==='fa'?'fa-IR':locale,opts).format(new Date(iso));
 const rows=result?.tool==='recentContacts'?result.data.contacts?.map(r=>({id:r.id,title:r.name,meta:r.status})):result?.data.tasks?.map(r=>({id:r.id,title:r.title,meta:r.dueDate?`${t.due} ${time(r.dueDate,{dateStyle:'medium'})}`:''}));
 return <View style={{gap:space.md}}>
  <Row justify="space-between"><AppText variant="title" weight="bold" accessibilityRole="header">{t.title}</AppText>{locked?null:<Chip label={t.free} icon="checkmark-circle-outline"/>}</Row>
  <View style={{flexDirection:rtl?'row-reverse':'row',gap:space.md}}>{(['recentContacts','followUpsDue'] as const).map(tool=><Card key={tool} highlight={result?.tool===tool} onPress={()=>void load(tool)} accessibilityLabel={t.tools[tool][0]} style={[s.tool,{backgroundColor:c.raised}]}>
   <View style={[s.icon,{backgroundColor:c.soft}]}>{busy===tool?<ActivityIndicator size="small" color={c.accent}/>:<Icon name={icons[tool]} size={20} color={c.accent}/>}</View>
   <AppText weight="bold">{t.tools[tool][0]}</AppText><AppText variant="caption" tone="muted">{t.tools[tool][1]}</AppText>
  </Card>)}</View>
  {locked?<View style={[s.list,{backgroundColor:c.raised}]}><Row gap={space.sm} style={s.row}><Icon name="lock-closed-outline" size={16} color={c.muted}/><AppText variant="caption" tone="muted" style={{flex:1}}>{t.locked}</AppText></Row></View>:null}
  {result?<View style={[s.list,{backgroundColor:c.raised}]}>
   {rows?.length?rows.map((row,i)=><View key={row.id} style={[s.row,i>0&&{borderTopWidth:StyleSheet.hairlineWidth,borderColor:c.border}]}>
    <Row gap={space.md}><Icon name={result.tool==='recentContacts'?'person-circle-outline':'checkbox-outline'} size={18} color={c.muted}/><AppText numberOfLines={1} style={{flex:1}}>{row.title}</AppText>{row.meta?<AppText variant="caption" tone="muted">{row.meta}</AppText>:null}</Row>
   </View>):<AppText tone="muted" variant="caption" style={s.row}>{t.empty[result.tool]}</AppText>}
   <AppText variant="tiny" tone="faint" style={{paddingHorizontal:space.md,paddingBottom:space.sm}}>{t.updated} {time(result.generatedAt,{timeStyle:'short'})}</AppText>
  </View>:null}
 </View>;
}
const s=StyleSheet.create({
 tool:{flex:1,minHeight:120},
 icon:{width:38,height:38,borderRadius:12,alignItems:'center',justifyContent:'center',marginBottom:space.xs},
 list:{borderRadius:radius.lg,overflow:'hidden'},
 row:{paddingHorizontal:space.md,paddingVertical:space.md},
});
