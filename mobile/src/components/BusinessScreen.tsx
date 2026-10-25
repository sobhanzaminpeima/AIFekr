import {useEffect,useState} from 'react';
import {ActivityIndicator,StyleSheet,View} from 'react-native';
import {contacts as contactsSchema,request} from '../api';
import {parseResources,resourcePaths,type Resource,type WorkModule} from '../workResources';
import type {Locale} from '../i18n';
import {radius,space} from '../design';
import {AppText,Banner,Card,Field,Icon,Row,type IconName} from '../ui/kit';
import {Initials,SectionTabs} from '../ui/forms';
import {StatTile} from '../ui/brand';
import {numberFormat,useTheme} from '../ui/theme';
import {WorkspacePicker} from './WorkspacePicker';
import {ContactEditor} from './ContactEditor';
import {PropertyManager} from './PropertyManager';
import {InvoiceManager} from './InvoiceManager';

type Section='customers'|'deals'|'tasks'|'properties'|'rentals'|'invoices'|'calls'|'appointments';
type Contact={id:string;name:string;email?:string|null;phone?:string|null};
const copy={
 fa:{title:'کسب‌وکار',sub:'مشتری‌ها، معاملات، املاک و فاکتورها در یک جا',search:'جستجوی مشتری…',customers:'مشتریان',deals:'معاملات',tasks:'پیگیری‌ها',properties:'املاک',rentals:'اجاره',invoices:'فاکتورها',calls:'تماس‌ها',appointments:'قرارها',count:'مشتری',empty:{customers:'هنوز مشتری‌ای ثبت نکرده‌ای.',deals:'معامله‌ای ثبت نشده.',tasks:'پیگیری‌ای نداری.',calls:'تماسی ثبت نشده.',appointments:'قراری ثبت نشده.'},retry:'تلاش دوباره',failed:'دریافت اطلاعات انجام نشد.',noMatch:'مشتری‌ای با این جستجو پیدا نشد.'},
 en:{title:'Business',sub:'Customers, deals, properties and invoices in one place',search:'Search customers…',customers:'Customers',deals:'Deals',tasks:'Follow-ups',properties:'Properties',rentals:'Rentals',invoices:'Invoices',calls:'Calls',appointments:'Appointments',count:'customers',empty:{customers:'No customers yet.',deals:'No deals yet.',tasks:'No follow-ups.',calls:'No calls yet.',appointments:'No appointments yet.'},retry:'Retry',failed:'Could not load data.',noMatch:'No customer matches this search.'},
 tr:{title:'İş',sub:'Müşteriler, anlaşmalar, emlak ve faturalar tek yerde',search:'Müşteri ara…',customers:'Müşteriler',deals:'Anlaşmalar',tasks:'Takipler',properties:'Emlak',rentals:'Kiralık',invoices:'Faturalar',calls:'Aramalar',appointments:'Randevular',count:'müşteri',empty:{customers:'Henüz müşteri yok.',deals:'Henüz anlaşma yok.',tasks:'Takip yok.',calls:'Henüz arama yok.',appointments:'Henüz randevu yok.'},retry:'Tekrar dene',failed:'Veriler alınamadı.',noMatch:'Bu aramayla eşleşen müşteri yok.'},
} as const;
const icons:Record<'deals'|'tasks'|'calls'|'appointments',IconName>={deals:'trending-up-outline',tasks:'alarm-outline',calls:'call-outline',appointments:'calendar-outline'};

export function BusinessScreen({locale,onError,onContact,workspaceRevision,onWorkspaceChange}:{locale:Locale;onError:(err:unknown)=>void;onContact:(id:string)=>void;workspaceRevision:number;onWorkspaceChange:()=>void}){
 const {c}=useTheme();const t=copy[locale];
 const [section,setSection]=useState<Section>('customers'),[people,setPeople]=useState<Contact[]>([]),[items,setItems]=useState<Resource[]>([]),[query,setQuery]=useState(''),[busy,setBusy]=useState(true),[failed,setFailed]=useState(false),[revision,setRevision]=useState(0);
 const managed=section==='properties'||section==='rentals'||section==='invoices';
 useEffect(()=>{let active=true;
  // Clear the previous section/workspace data before loading the current one.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  setBusy(true);setFailed(false);setItems([]);
  if(managed){setBusy(false);return()=>{active=false;};}
  const job=section==='customers'?request('/api/crm/contacts',locale).then(raw=>{if(active)setPeople(contactsSchema.parse(raw).contacts);}):request(resourcePaths[section as WorkModule],locale).then(raw=>{if(active)setItems(parseResources(section as WorkModule,raw,locale==='fa'?'fa-IR':locale));});
  job.catch(err=>{if(active){setFailed(true);onError(err);}}).finally(()=>{if(active)setBusy(false);});
  return()=>{active=false;};},[section,managed,locale,onError,revision,workspaceRevision]);
 const q=query.trim().toLocaleLowerCase(locale);
 const filtered=people.filter(p=>!q||[p.name,p.email,p.phone].some(v=>v?.toLocaleLowerCase(locale).includes(q)));
 const when=(iso:string)=>new Intl.DateTimeFormat(locale==='fa'?'fa-IR':locale,{dateStyle:'medium',timeStyle:'short'}).format(new Date(iso));
 const tabs=(['customers','deals','tasks','properties','rentals','invoices','calls','appointments'] as const).map(v=>({value:v,label:t[v]}));
 return <View style={{gap:space.lg}}>
  <View style={{gap:4}}><AppText variant="display" weight="bold" accessibilityRole="header">{t.title}</AppText><AppText variant="caption" tone="muted">{t.sub}</AppText></View>
  <WorkspacePicker key={workspaceRevision} locale={locale} onError={onError} onChange={()=>{setPeople([]);setQuery('');onWorkspaceChange();}}/>
  <SectionTabs value={section} tabs={tabs} onChange={setSection}/>
  {failed?<Banner text={t.failed} action={{label:t.retry,onPress:()=>setRevision(v=>v+1)}}/>:null}
  {section==='properties'||section==='rentals'?<PropertyManager key={section+workspaceRevision} locale={locale} onError={onError} rentals={section==='rentals'}/>:null}
  {section==='invoices'?<InvoiceManager key={workspaceRevision} locale={locale} onError={onError}/>:null}
  {section==='customers'?<View style={{gap:space.md}}>
   <Row gap={space.sm}><StatTile icon="people-outline" value={numberFormat(locale,people.length)} label={t.count}/></Row>
   <Row gap={space.sm}><View style={{flex:1}}><Field accessibilityLabel={t.search} placeholder={t.search} value={query} onChangeText={setQuery} maxLength={100}/></View></Row>
   <ContactEditor locale={locale} onError={onError} onSaved={()=>setRevision(v=>v+1)}/>
   {busy?<ActivityIndicator color={c.accent}/>:!people.length&&!failed?<Empty icon="people-outline" text={t.empty.customers}/>:!filtered.length?<AppText variant="caption" tone="muted">{t.noMatch}</AppText>:null}
   {filtered.length?<View style={[s.list,{backgroundColor:c.surface}]}>{filtered.map((person,i)=><Card key={person.id} accessibilityLabel={person.name} onPress={()=>onContact(person.id)} style={[s.person,i>0&&{borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:c.border}]}>
    <Row gap={space.md}><Initials name={person.name}/><View style={{flex:1}}><AppText weight="medium" numberOfLines={1}>{person.name}</AppText>{person.phone||person.email?<AppText variant="caption" tone="muted" numberOfLines={1} style={{writingDirection:'ltr'}}>{person.phone||person.email}</AppText>:null}</View><Icon name="chevron-forward" size={16} color={c.faint} mirror/></Row>
   </Card>)}</View>:null}
  </View>:null}
  {!managed&&section!=='customers'?<View style={{gap:space.sm}}>
   {busy?<ActivityIndicator color={c.accent}/>:!items.length&&!failed?<Empty icon={icons[section]} text={t.empty[section]}/>:null}
   {items.map(item=><Card key={item.id}>
    <Row gap={space.md} style={{alignItems:'flex-start'}}>
     <View style={[s.icon,{backgroundColor:c.soft}]}><Icon name={icons[section]} size={18} color={c.accent}/></View>
     <View style={{flex:1,gap:2}}><AppText weight="medium">{item.title}</AppText>{item.detail?<AppText variant="caption" tone="muted">{item.detail}</AppText>:null}{item.date?<Row gap={4}><Icon name="time-outline" size={12} color={c.faint}/><AppText variant="tiny" tone="faint">{when(item.date)}</AppText></Row>:null}</View>
    </Row>
   </Card>)}
  </View>:null}
 </View>;
}

function Empty({icon,text}:{icon:IconName;text:string}){
 const {c}=useTheme();
 return <View style={[s.empty,{backgroundColor:c.surface}]}><Icon name={icon} size={30} color={c.accent}/><AppText tone="muted" align="center">{text}</AppText></View>;
}
const s=StyleSheet.create({
 list:{borderRadius:radius.lg,overflow:'hidden'},
 person:{borderRadius:0,paddingVertical:space.md,borderWidth:0,borderColor:'transparent'},
 icon:{width:38,height:38,borderRadius:12,alignItems:'center',justifyContent:'center'},
 empty:{borderRadius:radius.lg,padding:space.xl,alignItems:'center',gap:space.sm},
});
