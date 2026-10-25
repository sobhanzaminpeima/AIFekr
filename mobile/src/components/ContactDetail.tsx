import {useEffect,useState,type ReactNode} from 'react';
import {ActivityIndicator,Linking,ScrollView,StyleSheet,View} from 'react-native';
import {z} from 'zod';
import {request} from '../api';
import type {Locale} from '../i18n';
import {radius,space} from '../design';
import {AppText,Button,Card,Chip,Field,Icon,IconButton,Row,type IconName} from '../ui/kit';
import {Initials} from '../ui/forms';
import {useTheme} from '../ui/theme';
import {ContactEditor} from './ContactEditor';
import {DealComposer} from './DealComposer';
import {ContactActivity} from './ContactActivity';

const schema=z.object({context:z.object({workspaceUserId:z.string(),businessId:z.string().nullable()}),contact:z.object({id:z.string(),name:z.string(),email:z.string().nullable(),phone:z.string().nullable(),company:z.string().nullable(),status:z.string()}),deals:z.array(z.object({id:z.string(),title:z.string(),status:z.string(),probability:z.number(),pipelineId:z.string(),stageId:z.string()})),tasks:z.array(z.object({id:z.string(),title:z.string(),status:z.string(),dueDate:z.string().nullable(),draftMessage:z.string().nullable()})),activities:z.array(z.object({id:z.string(),type:z.string(),content:z.string(),createdAt:z.string()}))});
const copy={fa:{back:'بازگشت',call:'تماس',email:'ایمیل',tasks:'پیگیری‌ها',deals:'معاملات',history:'سوابق',log:'ثبت فعالیت',newTask:'پیگیری جدید…',add:'افزودن',done:'انجام شد',sure:'انجام‌شده علامت بخورد؟',yes:'بله',no:'نه',draft:'پیش‌نویس پیام؛ ارسال نشده',noTasks:'پیگیری بازی نیست.',noDeals:'معامله‌ای ثبت نشده.',noHistory:'هنوز فعالیتی ثبت نشده.',status:{open:'باز',done:'انجام شده',pending:'در انتظار',LEAD:'سرنخ',QUALIFIED:'واجد شرایط',PROPOSAL:'پیشنهاد',CUSTOMER:'مشتری',CLIENT:'مشتری',LOST:'از دست رفته',IN_PROGRESS:'در جریان',CONTACTED:'تماس گرفته‌شده',won:'برنده',lost:'از دست رفته'}},en:{back:'Back',call:'Call',email:'Email',tasks:'Follow-ups',deals:'Deals',history:'History',log:'Log activity',newTask:'New follow-up…',add:'Add',done:'Done',sure:'Mark as done?',yes:'Yes',no:'No',draft:'Message draft; not sent',noTasks:'No open follow-ups.',noDeals:'No deals yet.',noHistory:'No activity yet.',status:{open:'Open',done:'Done',pending:'Pending',LEAD:'Lead',QUALIFIED:'Qualified',PROPOSAL:'Proposal',CUSTOMER:'Customer',CLIENT:'Client',LOST:'Lost',IN_PROGRESS:'In progress',CONTACTED:'Contacted',won:'Won',lost:'Lost'}},tr:{back:'Geri',call:'Ara',email:'E-posta',tasks:'Takipler',deals:'Anlaşmalar',history:'Geçmiş',log:'Etkinlik kaydet',newTask:'Yeni takip…',add:'Ekle',done:'Tamam',sure:'Tamamlandı işaretlensin mi?',yes:'Evet',no:'Hayır',draft:'Mesaj taslağı; gönderilmedi',noTasks:'Açık takip yok.',noDeals:'Henüz anlaşma yok.',noHistory:'Henüz etkinlik yok.',status:{open:'Açık',done:'Tamam',pending:'Bekliyor',LEAD:'Aday',QUALIFIED:'Nitelikli',PROPOSAL:'Teklif',CUSTOMER:'Müşteri',CLIENT:'Müşteri',LOST:'Kaybedildi',IN_PROGRESS:'Sürüyor',CONTACTED:'İletişime geçildi',won:'Kazanıldı',lost:'Kaybedildi'}}};

export function ContactDetail({id,locale,onError,onClose,workspaceRevision}:{id:string;locale:Locale;onError:(err:unknown)=>void;onClose:()=>void;workspaceRevision:number}){
 const {c}=useTheme();const t=copy[locale];
 const [data,setData]=useState<z.infer<typeof schema>|null>(null),[revision,setRevision]=useState(0),[task,setTask]=useState(''),[busy,setBusy]=useState(false),[confirming,setConfirming]=useState<string|null>(null),[logging,setLogging]=useState(false);
 useEffect(()=>{let active=true;
 // eslint-disable-next-line react-hooks/set-state-in-effect
 setData(null);request(`/api/mobile/v1/crm/contacts/${encodeURIComponent(id)}`,locale).then(raw=>{if(active)setData(schema.parse(raw));}).catch(err=>{if(active)onError(err);});return()=>{active=false;};},[id,locale,revision,onError,workspaceRevision]);
 async function update(action:'task.create'|'task.update',taskId?:string){setBusy(true);setConfirming(null);try{await request('/api/mobile/v1/crm',locale,{method:'POST',body:JSON.stringify({action,requestKey:`crm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`,...(taskId?{id:taskId}:{}),data:taskId?{status:'done'}:{contactId:id,title:task.trim()}})});setTask('');setRevision(v=>v+1);}catch(err){onError(err);}finally{setBusy(false);}}
 const when=(iso:string)=>new Intl.DateTimeFormat(locale==='fa'?'fa-IR':locale,{dateStyle:'medium',timeStyle:'short'}).format(new Date(iso));
 const label=(s:string)=>(t.status as Record<string,string>)[s]??s;
 return <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
  <Row><IconButton icon="arrow-back" label={t.back} mirror onPress={onClose}/></Row>
  {!data?<ActivityIndicator color={c.accent}/>:<>
   <View style={s.head}>
    <Initials name={data.contact.name} size={72}/>
    <AppText variant="title" weight="bold" align="center" accessibilityRole="header">{data.contact.name}</AppText>
    <Row gap={space.sm} justify="center">{data.contact.company?<Chip tone="raised" icon="business-outline" label={data.contact.company}/>:null}<Chip label={label(data.contact.status)}/></Row>
    <Row gap={space.sm} justify="center">
     {data.contact.phone?<Button label={t.call} icon="call-outline" variant="secondary" onPress={()=>{void Linking.openURL('tel:'+data.contact.phone).catch(onError);}}/>:null}
     {data.contact.email?<Button label={t.email} icon="mail-outline" variant="secondary" onPress={()=>{void Linking.openURL('mailto:'+data.contact.email).catch(onError);}}/>:null}
     <Button label={t.log} icon="create-outline" variant="secondary" onPress={()=>setLogging(v=>!v)}/>
    </Row>
    <ContactEditor key={`${id}-${revision}`} contact={data.contact} locale={locale} onError={onError} onSaved={()=>setRevision(v=>v+1)}/>
   </View>
   {logging?<Card><ContactActivity key={id+workspaceRevision} contactId={id} phone={data.contact.phone} context={data.context} locale={locale} color={c.text} onError={onError} onChanged={()=>{setLogging(false);setRevision(v=>v+1);}}/></Card>:null}
   <Section icon="alarm-outline" title={t.tasks}>
    <Row gap={space.sm}><Field style={{flex:1}} accessibilityLabel={t.newTask} value={task} onChangeText={setTask} maxLength={200} placeholder={t.newTask} editable={!busy}/><Button label={t.add} icon="add" busy={busy} disabled={!task.trim()} onPress={()=>void update('task.create')}/></Row>
    {data.tasks.length?data.tasks.map(item=><View key={item.id} style={[s.row,{backgroundColor:c.raised}]}>
     <Row gap={space.md}><Icon name={item.status==='done'?'checkmark-circle':'ellipse-outline'} size={20} color={item.status==='done'?c.success:c.accent}/><View style={{flex:1}}><AppText>{item.title}</AppText>{item.dueDate?<AppText variant="tiny" tone="faint">{when(item.dueDate)}</AppText>:null}</View>
      {item.status!=='done'&&confirming!==item.id?<Button label={t.done} variant="ghost" onPress={()=>setConfirming(item.id)}/>:null}</Row>
     {confirming===item.id?<Row gap={space.sm}><AppText variant="caption" style={{flex:1}}>{t.sure}</AppText><Button label={t.yes} onPress={()=>void update('task.update',item.id)}/><Button label={t.no} variant="ghost" onPress={()=>setConfirming(null)}/></Row>:null}
     {item.draftMessage?<View style={[s.draft,{borderColor:c.border}]}><AppText variant="tiny" tone="faint">{t.draft}</AppText><AppText variant="caption" selectable>{item.draftMessage}</AppText></View>:null}
    </View>):<AppText variant="caption" tone="muted">{t.noTasks}</AppText>}
   </Section>
   <Section icon="trending-up-outline" title={t.deals}>
    {data.deals.length?data.deals.map(item=><Row key={item.id} gap={space.md} style={[s.row,{backgroundColor:c.raised}]}><AppText style={{flex:1}}>{item.title}</AppText><Chip tone="raised" label={label(item.status)}/><AppText variant="caption" weight="bold" tone="accent">{item.probability}%</AppText></Row>):<AppText variant="caption" tone="muted">{t.noDeals}</AppText>}
    <DealComposer contactId={id} deals={data.deals} locale={locale} color={c.text} onError={onError} onChanged={()=>setRevision(v=>v+1)}/>
   </Section>
   <Section icon="time-outline" title={t.history}>
    {data.activities.length?data.activities.map(item=><View key={item.id} style={[s.row,{backgroundColor:c.raised}]}><Row justify="space-between"><Chip tone="raised" label={item.type}/><AppText variant="tiny" tone="faint">{when(item.createdAt)}</AppText></Row><AppText variant="caption">{item.content}</AppText></View>):<AppText variant="caption" tone="muted">{t.noHistory}</AppText>}
   </Section>
  </>}
 </ScrollView>;
}

function Section({icon,title,children}:{icon:IconName;title:string;children:ReactNode}){
 const {c}=useTheme();
 return <Card><Row gap={space.sm}><Icon name={icon} size={18} color={c.accent}/><AppText weight="bold">{title}</AppText></Row>{children}</Card>;
}
const s=StyleSheet.create({
 page:{padding:space.lg,gap:space.lg,paddingBottom:space.xxl},
 head:{alignItems:'center',gap:space.md},
 row:{borderRadius:radius.md,padding:space.md,gap:space.sm},
 draft:{borderTopWidth:StyleSheet.hairlineWidth,paddingTop:space.sm,gap:2},
});
