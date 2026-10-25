import {useEffect,useState} from 'react';
import {ActivityIndicator,StyleSheet,View} from 'react-native';
import {z} from 'zod';
import {ApiError,request} from '../api';
import type {Locale} from '../i18n';
import {radius,space} from '../design';
import {AppText,Button,Chip,Icon,IconButton,Row,success} from '../ui/kit';
import {numberFormat,useTheme} from '../ui/theme';

const schema=z.object({actions:z.array(z.object({id:z.string(),summary:z.string(),status:z.string(),expired:z.boolean(),expiresAt:z.string(),credits:z.number()}))});
type Action=z.infer<typeof schema>['actions'][number];
const copy={
 fa:{title:'در انتظار تأیید',history:'اخیر',approve:'تأیید',reject:'رد',sure:'انجام شود؟',yes:'بله، انجام بده',no:'انصراف',refresh:'به‌روزرسانی',until:'معتبر تا',credits:(n:string)=>`${n} اعتبار`,free:'بدون هزینه',emptyTitle:'کاری منتظر تأیید نیست',denied:'دسترسی لازم برای این تغییر را نداری.',emptyBody:'وقتی فیکا تغییری در داده‌هایت پیشنهاد کند، اینجا می‌آید و فقط با تأیید تو انجام می‌شود.',status:{PENDING:'در انتظار',CONFIRMED:'تأیید شد',EXECUTED:'انجام شد',REJECTED:'رد شد',EXPIRED:'منقضی شد',FAILED:'ناموفق'}},
 en:{title:'Waiting for approval',history:'Recent',approve:'Approve',reject:'Reject',sure:'Go ahead?',yes:'Yes, do it',no:'Cancel',refresh:'Refresh',until:'Valid until',credits:(n:string)=>`${n} credits`,free:'No cost',emptyTitle:'Nothing to approve',denied:"You don't have permission for this change.",emptyBody:'When FIKA suggests a change to your data, it shows up here and only happens after you approve it.',status:{PENDING:'Pending',CONFIRMED:'Approved',EXECUTED:'Done',REJECTED:'Rejected',EXPIRED:'Expired',FAILED:'Failed'}},
 tr:{title:'Onay bekleyenler',history:'Son',approve:'Onayla',reject:'Reddet',sure:'Yapılsın mı?',yes:'Evet, yap',no:'Vazgeç',refresh:'Yenile',until:'Geçerlilik',credits:(n:string)=>`${n} kredi`,free:'Ücretsiz',emptyTitle:'Onay bekleyen yok',denied:'Bu değişiklik için yetkin yok.',emptyBody:'FIKA verilerinde bir değişiklik önerdiğinde burada görünür ve yalnızca onayınla yapılır.',status:{PENDING:'Bekliyor',CONFIRMED:'Onaylandı',EXECUTED:'Yapıldı',REJECTED:'Reddedildi',EXPIRED:'Süresi doldu',FAILED:'Başarısız'}},
} as const;

export function ActionCenter({locale,onError}:{locale:Locale;onError:(err:unknown)=>void}){
 const {c}=useTheme();const t=copy[locale];
 const [actions,setActions]=useState<Action[]|null>(null),[busy,setBusy]=useState<string|null>(null),[confirming,setConfirming]=useState<string|null>(null),[revision,setRevision]=useState(0),[notice,setNotice]=useState('');
 useEffect(()=>{let active=true;request('/api/mobile/v1/actions',locale).then(raw=>{if(active)setActions(schema.parse(raw).actions);}).catch(err=>{if(active)onError(err);});return()=>{active=false;};},[locale,revision,onError]);
 async function decide(action:Action,decision:'confirm'|'reject'){setBusy(action.id);setConfirming(null);setNotice('');try{await request(`/api/mobile/v1/actions/${encodeURIComponent(action.id)}`,locale,{method:'POST',body:JSON.stringify({decision,reviewedSummary:action.summary})});if(decision==='confirm')success();}catch(err){if(err instanceof ApiError&&err.status===403)setNotice(t.denied);else onError(err);}finally{setBusy(null);setRevision(v=>v+1);}}
 const time=(iso:string)=>new Intl.DateTimeFormat(locale==='fa'?'fa-IR':locale,{dateStyle:'medium',timeStyle:'short'}).format(new Date(iso));
 const label=(status:string)=>(t.status as Record<string,string>)[status]??status;
 const pending=(actions??[]).filter(a=>a.status==='PENDING'&&!a.expired),past=(actions??[]).filter(a=>!(a.status==='PENDING'&&!a.expired)).slice(0,5);
 return <View style={{gap:space.md}}>
  <Row justify="space-between">
   <Row gap={space.sm}><AppText variant="title" weight="bold" accessibilityRole="header">{t.title}</AppText>{pending.length?<View style={[s.badge,{backgroundColor:c.accent}]}><AppText variant="tiny" weight="bold" tone="onAccent" align="center">{numberFormat(locale,pending.length)}</AppText></View>:null}</Row>
   <IconButton icon="refresh" label={t.refresh} size={34} onPress={()=>setRevision(v=>v+1)}/>
  </Row>
  {actions===null?<ActivityIndicator color={c.accent}/>:!pending.length&&!past.length?<View style={[s.empty,{backgroundColor:c.raised}]}>
   <Icon name="shield-checkmark-outline" size={28} color={c.accent}/><AppText weight="bold" align="center">{t.emptyTitle}</AppText><AppText variant="caption" tone="muted" align="center">{t.emptyBody}</AppText>
  </View>:null}
  {notice?<AppText variant="caption" tone="danger" accessibilityRole="alert">{notice}</AppText>:null}
  {!pending.length&&past.length?<AppText variant="caption" tone="muted">{t.emptyTitle}</AppText>:null}
  {pending.length?<View style={[s.list,{backgroundColor:c.raised}]}>{pending.map((action,i)=><View key={action.id} style={[s.row,i>0&&{borderTopWidth:StyleSheet.hairlineWidth,borderColor:c.border}]}>
   <Row gap={space.md} style={{alignItems:'flex-start'}}><View style={[s.dot,{backgroundColor:c.soft}]}><Icon name="git-compare-outline" size={16} color={c.accent}/></View>
    <View style={{flex:1,gap:4}}><AppText>{action.summary}</AppText><AppText variant="caption" tone="faint">{t.until} {time(action.expiresAt)} · {action.credits?t.credits(numberFormat(locale,action.credits)):t.free}</AppText></View></Row>
   {busy===action.id?<ActivityIndicator color={c.accent}/>:confirming===action.id?<View style={{gap:space.sm}}><AppText variant="caption" weight="bold">{t.sure}</AppText><Row gap={space.sm}><Button style={{flex:1}} label={t.yes} icon="checkmark" onPress={()=>void decide(action,'confirm')}/><Button label={t.no} variant="ghost" onPress={()=>setConfirming(null)}/></Row></View>
   :<Row gap={space.sm}><Button style={{flex:1}} label={t.approve} icon="checkmark" onPress={()=>setConfirming(action.id)}/><Button style={{flex:1}} label={t.reject} variant="ghost" onPress={()=>void decide(action,'reject')}/></Row>}
  </View>)}</View>:null}
  {past.length?<View style={{gap:space.sm}}>
   <AppText variant="caption" weight="bold" tone="muted">{t.history}</AppText>
   <View style={[s.list,{backgroundColor:c.raised}]}>{past.map((action,i)=><Row key={action.id} gap={space.md} style={[s.row,i>0&&{borderTopWidth:StyleSheet.hairlineWidth,borderColor:c.border}]}>
    <AppText numberOfLines={2} variant="caption" style={{flex:1}}>{action.summary}</AppText><Chip tone="raised" label={action.expired&&action.status==='PENDING'?label('EXPIRED'):label(action.status)}/>
   </Row>)}</View>
  </View>:null}
 </View>;
}
const s=StyleSheet.create({
 badge:{minWidth:22,height:22,borderRadius:11,paddingHorizontal:6,justifyContent:'center'},
 empty:{borderRadius:radius.lg,padding:space.xl,gap:space.sm,alignItems:'center'},
 list:{borderRadius:radius.lg,overflow:'hidden'},
 row:{padding:space.md,gap:space.md},
 dot:{width:30,height:30,borderRadius:10,alignItems:'center',justifyContent:'center'},
});
