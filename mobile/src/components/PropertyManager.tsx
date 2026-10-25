import {useEffect,useState} from 'react';
import {ActivityIndicator,StyleSheet,View} from 'react-native';
import {randomUUID} from 'expo-crypto';
import {z} from 'zod';
import {ApiError,request} from '../api';
import {changeOfflineState,readOfflineState} from '../offlineVault';
import {onOfflineChange,queuePlannerMutation,submitPlannerMutation} from '../offlinePlanner';
import {normalizeWholeAmount,propertyCatalog,propertyFields} from '../property';
import type {Locale} from '../i18n';
import {radius,space} from '../design';
import {AppText,Banner,Button,Card,Chip,Field,Icon,Row,Sheet} from '../ui/kit';
import {Labeled,Options} from '../ui/forms';
import {StatTile} from '../ui/brand';
import {numberFormat,useTheme} from '../ui/theme';

const labels={
 fa:{title:'املاک',locked:'این بخش برای حساب یا نقش فعلی‌ات فعال نیست؛ به افزونهٔ CRM یا دسترسی مدیر فضای کاری نیاز دارد.',rentalsTitle:'اجاره‌ها',new:'فایل جدید',save:'ذخیرهٔ فایل',editTitle:'ویرایش فایل',newTitle:'فایل جدید',cancel:'انصراف',address:'آدرس',city:'شهر',description:'توضیحات',name:'عنوان ملک',price:'قیمت کل',nightly:'قیمت هر شب',currency:'ارز (بدون تبدیل)',contact:'مشتری مرتبط',none:'بدون مشتری',type:'نوع ملک',status:'وضعیت',listing:'نوع آگهی',cached:'نسخهٔ آفلاین؛ ممکن است به‌روز نباشد.',offlineNote:'بدون اینترنت هم ذخیره می‌شود و بعد از اتصال ارسال می‌شود.',summary:(amount:string,cur:string)=>`مبلغ ثبت‌شده: ${amount} ${cur}`,total:'کل فایل‌ها',available:'موجود',empty:'هنوز فایلی ثبت نکرده‌ای.',emptyRentals:'هنوز ملک اجاره‌ای ثبت نکرده‌ای.',perNight:'هر شب',buy:'خرید',sell:'فروش',rent:'اجاره',short_term_rent:'اجارهٔ کوتاه‌مدت',pending:'در انتظار',sold:'فروخته‌شده',rented:'اجاره‌داده‌شده'},
 en:{title:'Properties',locked:'Not available for your current plan or role; it needs the CRM add-on or workspace manager access.',rentalsTitle:'Rentals',new:'New listing',save:'Save listing',editTitle:'Edit listing',newTitle:'New listing',cancel:'Cancel',address:'Address',city:'City',description:'Description',name:'Property title',price:'Total price',nightly:'Nightly price',currency:'Currency (no conversion)',contact:'Related contact',none:'No contact',type:'Property type',status:'Status',listing:'Listing type',cached:'Offline copy; may be out of date.',offlineNote:'Saves offline too and is sent once you reconnect.',summary:(amount:string,cur:string)=>`Amount saved: ${amount} ${cur}`,total:'All listings',available:'Available',empty:'No listings yet.',emptyRentals:'No rental properties yet.',perNight:'per night',buy:'Buy',sell:'Sell',rent:'Rent',short_term_rent:'Short-term rental',pending:'Pending',sold:'Sold',rented:'Rented'},
 tr:{title:'Emlak',locked:'Mevcut paketin veya rolün için açık değil; CRM eklentisi ya da çalışma alanı yöneticisi yetkisi gerekir.',rentalsTitle:'Kiralıklar',new:'Yeni ilan',save:'İlanı kaydet',editTitle:'İlanı düzenle',newTitle:'Yeni ilan',cancel:'Vazgeç',address:'Adres',city:'Şehir',description:'Açıklama',name:'Emlak başlığı',price:'Toplam fiyat',nightly:'Gecelik fiyat',currency:'Para birimi (dönüştürme yok)',contact:'İlgili kişi',none:'Kişi yok',type:'Emlak türü',status:'Durum',listing:'İlan türü',cached:'Çevrimdışı kopya; güncel olmayabilir.',offlineNote:'Çevrimdışı da kaydedilir, bağlanınca gönderilir.',summary:(amount:string,cur:string)=>`Kaydedilen tutar: ${amount} ${cur}`,total:'Tüm ilanlar',available:'Mevcut',empty:'Henüz ilan yok.',emptyRentals:'Henüz kiralık yok.',perNight:'gecelik',buy:'Satın al',sell:'Sat',rent:'Kirala',short_term_rent:'Kısa süreli kira',pending:'Bekliyor',sold:'Satıldı',rented:'Kiralandı'},
} as const;
type Fields=z.infer<typeof propertyFields>;
const currencies=['IRT','IRR','USD','GBP','EUR','TRY'] as const;
const fresh=(rentals:boolean):Fields=>({title:'',listingType:rentals?'short_term_rent':'sell',propertyType:'apartment',price:'0',nightlyPrice:null,currency:'IRT',address:'',city:'',description:'',status:'available',crmContactId:null});

export function PropertyManager({locale,onError,rentals=false}:{locale:Locale;onError:(e:unknown)=>void;rentals?:boolean}){
 const {c}=useTheme();const t=labels[locale];
 const [formScope,setFormScope]=useState<z.infer<typeof propertyCatalog>['context']|null>(null);const [catalog,setCatalog]=useState<z.infer<typeof propertyCatalog>|null>(null),[fields,setFields]=useState<Fields>(()=>fresh(rentals)),[editing,setEditing]=useState<{id:string;version:string}|null>(null),[show,setShow]=useState(false),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0),[offline,setOffline]=useState(false),[loaded,setLoaded]=useState(false),[locked,setLocked]=useState(false);
 useEffect(()=>onOfflineChange(()=>setRevision(value=>value+1)),[]);
 useEffect(()=>{let active=true;async function load(){try{const parsed=propertyCatalog.parse(await request('/api/mobile/v1/properties',locale));if(!active)return;setCatalog(parsed);setOffline(false);await changeOfflineState(state=>{state.properties={savedAt:new Date().toISOString(),data:parsed};});}catch(error){if(!active)return;if(!(error instanceof ApiError)){try{const stored=(await readOfflineState())?.properties;if(stored){setCatalog(propertyCatalog.parse(stored.data));setOffline(true);return;}}catch(storageError){onError(storageError);}}setCatalog(null);if(error instanceof ApiError&&(error.status===402||error.status===403))setLocked(true);else onError(error);}finally{if(active)setLoaded(true);}}void load();return()=>{active=false;};},[locale,revision,onError]);
 function set<K extends keyof Fields>(key:K,value:Fields[K]){setFields(current=>({...current,[key]:value}));}
 async function save(){if(busy||!catalog||!formScope)return;setBusy(true);try{const data={...fields,city:fields.city||'',description:fields.description||'',price:normalizeWholeAmount(fields.price),nightlyPrice:fields.listingType==='short_term_rent'?normalizeWholeAmount(fields.nightlyPrice||''):null};const payload={action:editing?'update':'create',context:formScope,data,requestKey:'property_'+randomUUID(),...(editing||{})};const row=await queuePlannerMutation(payload);await submitPlannerMutation(row.body,locale);setShow(false);setEditing(null);setRevision(value=>value+1);}catch(error){onError(error);}finally{setBusy(false);}}
 const money=(value:string|null|undefined)=>{const n=Number(value);return Number.isFinite(n)?numberFormat(locale,n):value||'0';};
 const rows=(catalog?.properties??[]).filter(row=>!rentals||row.listingType==='short_term_rent');
 const nightly=fields.listingType==='short_term_rent';
 const amount=nightly?fields.nightlyPrice||'':fields.price;
 return <View style={{gap:space.md}}>
  <Row justify="space-between"><AppText variant="title" weight="bold" accessibilityRole="header">{rentals?t.rentalsTitle:t.title}</AppText>{locked?null:<Button label={t.new} icon="add" disabled={busy||!catalog} onPress={()=>{setFields(fresh(rentals));setFormScope(catalog?.context||null);setEditing(null);setShow(true);}}/>}</Row>
  {offline?<Banner tone="info" text={t.cached}/>:null}
  {rows.length?<Row gap={space.sm}><StatTile icon="home-outline" value={numberFormat(locale,rows.length)} label={t.total}/><StatTile icon="checkmark-circle-outline" value={numberFormat(locale,rows.filter(r=>r.status==='available').length)} label={t.available}/></Row>:null}
  {locked?<View style={[s.empty,{backgroundColor:c.surface}]}><Icon name="lock-closed-outline" size={28} color={c.accent}/><AppText tone="muted" align="center">{t.locked}</AppText></View>:!loaded?<ActivityIndicator color={c.accent}/>:!rows.length?<View style={[s.empty,{backgroundColor:c.surface}]}><Icon name={rentals?'bed-outline':'home-outline'} size={30} color={c.accent}/><AppText tone="muted" align="center">{rentals?t.emptyRentals:t.empty}</AppText></View>:null}
  {rows.map(row=><Card key={row.id} accessibilityLabel={row.title} onPress={()=>{setFields(propertyFields.parse(row));setFormScope(catalog!.context);setEditing({id:row.id,version:row.version});setShow(true);}}>
   <Row gap={space.md} style={{alignItems:'flex-start'}}>
    <View style={[s.thumb,{backgroundColor:c.soft}]}><Icon name={row.listingType==='short_term_rent'?'bed-outline':'home-outline'} size={24} color={c.accent}/></View>
    <View style={{flex:1,gap:4}}>
     <AppText weight="bold" numberOfLines={1}>{row.title}</AppText>
     <Row gap={4}><Icon name="location-outline" size={14} color={c.faint}/><AppText variant="caption" tone="muted" numberOfLines={1} style={{flex:1}}>{[row.address,row.city].filter(Boolean).join('، ')}</AppText></Row>
     <AppText weight="bold" tone="accent">{money(row.listingType==='short_term_rent'?row.nightlyPrice:row.price)} {row.currency}{row.listingType==='short_term_rent'?` · ${t.perNight}`:''}</AppText>
     <Row gap={space.xs}><Chip tone="raised" label={t[row.listingType]}/><Chip label={t[row.status]}/></Row>
    </View>
   </Row>
  </Card>)}
  <Sheet visible={show} onClose={()=>setShow(false)} title={editing?t.editTitle:t.newTitle}>
   <Labeled label={t.name}><Field accessibilityLabel={t.name} value={fields.title} onChangeText={v=>set('title',v)} maxLength={200} editable={!busy}/></Labeled>
   <Labeled label={t.listing}><Options value={fields.listingType} disabled={busy||!!editing} onChange={v=>set('listingType',v)} options={(['sell','buy','rent','short_term_rent'] as const).map(v=>({value:v,label:t[v]}))}/></Labeled>
   <Labeled label={t.type}><Field accessibilityLabel={t.type} value={fields.propertyType} onChangeText={v=>set('propertyType',v)} maxLength={40} editable={!busy}/></Labeled>
   <Labeled label={t.address}><Field accessibilityLabel={t.address} value={fields.address} onChangeText={v=>set('address',v)} maxLength={500} editable={!busy}/></Labeled>
   <Labeled label={t.city}><Field accessibilityLabel={t.city} value={fields.city||''} onChangeText={v=>set('city',v)} maxLength={100} editable={!busy}/></Labeled>
   <Labeled label={t.currency}><Options value={fields.currency} disabled={busy} onChange={v=>set('currency',v)} options={currencies.map(v=>({value:v,label:v}))}/></Labeled>
   <Labeled label={`${nightly?t.nightly:t.price} · ${fields.currency}`}><Field accessibilityLabel={nightly?t.nightly:t.price} value={amount} onChangeText={v=>set(nightly?'nightlyPrice':'price',v)} keyboardType="number-pad" maxLength={24} editable={!busy} style={{textAlign:'left',writingDirection:'ltr'}}/></Labeled>
   <Labeled label={t.status}><Options value={fields.status} disabled={busy} onChange={v=>set('status',v)} options={(['available','pending','sold','rented'] as const).map(v=>({value:v,label:t[v]}))}/></Labeled>
   {catalog?.contacts.length?<Labeled label={t.contact}><Options scroll value={fields.crmContactId??'__none'} disabled={busy} onChange={v=>set('crmContactId',v==='__none'?null:v)} options={[{value:'__none',label:t.none},...catalog.contacts.map(x=>({value:x.id,label:x.name}))]}/></Labeled>:null}
   <Labeled label={t.description}><Field accessibilityLabel={t.description} value={fields.description||''} onChangeText={v=>set('description',v)} maxLength={10000} multiline editable={!busy} style={{minHeight:96,textAlignVertical:'top'}}/></Labeled>
   <AppText variant="caption" weight="bold">{t.summary(money(amount),fields.currency)}</AppText>
   <AppText variant="tiny" tone="faint">{t.offlineNote}</AppText>
   <Button label={t.save} icon="checkmark" busy={busy} disabled={!fields.title.trim()||!fields.address.trim()} onPress={()=>void save()}/>
   <Button label={t.cancel} variant="ghost" onPress={()=>setShow(false)}/>
  </Sheet>
 </View>;
}
const s=StyleSheet.create({
 thumb:{width:56,height:56,borderRadius:radius.md,alignItems:'center',justifyContent:'center'},
 empty:{borderRadius:radius.lg,padding:space.xl,alignItems:'center',gap:space.sm},
});
