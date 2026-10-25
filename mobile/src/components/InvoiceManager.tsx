import {useEffect,useRef,useState} from 'react';
import {ActivityIndicator,StyleSheet,View} from 'react-native';
import {randomUUID} from 'expo-crypto';
import {z} from 'zod';
import {ApiError,request} from '../api';
import {DateTimeField} from './DateTimeField';
import type {Locale} from '../i18n';
import {radius,space} from '../design';
import {AppText,Button,Card,Chip,Field,Icon,IconButton,Row,Sheet} from '../ui/kit';
import {Labeled,Options} from '../ui/forms';
import {StatTile} from '../ui/brand';
import {numberFormat,useTheme} from '../ui/theme';

const item=z.object({description:z.string(),quantity:z.number(),unitPrice:z.number(),taxRate:z.number()});
const schema=z.object({context:z.object({workspaceUserId:z.string(),businessId:z.string().nullable()}),contacts:z.array(z.object({id:z.string(),name:z.string()})),invoices:z.array(z.object({id:z.string(),invoiceNumber:z.string(),contactId:z.string(),status:z.string(),total:z.number(),currency:z.enum(['IRT','IRR','USD','GBP','EUR','TRY']),discount:z.number(),notes:z.string().nullable(),dueDate:z.string().nullable(),version:z.string(),items:z.array(item)}))});
const copy={
 fa:{title:'فاکتورها',locked:'این بخش برای حساب یا نقش فعلی‌ات فعال نیست؛ به افزونهٔ CRM یا دسترسی مدیر فضای کاری نیاز دارد.',currency:'ارز (بدون تبدیل)',new:'فاکتور جدید',save:'ذخیرهٔ پیش‌نویس',newTitle:'پیش‌نویس فاکتور',editTitle:'ویرایش پیش‌نویس',cancel:'انصراف',contact:'مشتری',description:'شرح',quantity:'تعداد',price:'قیمت واحد',tax:'مالیات ٪',discount:'تخفیف',notes:'یادداشت',add:'افزودن ردیف',remove:'حذف ردیف',due:'موعد پرداخت',noDue:'بدون موعد',setDue:'تعیین موعد',total:'جمع نهایی',line:(n:string)=>`ردیف ${n}`,hint:'پیش‌نویس به مشتری ارسال نمی‌شود و پرداختی ثبت نمی‌کند. مبلغ‌ها به همین ارز است.',all:'همه',drafts:'پیش‌نویس',empty:'هنوز فاکتوری نساخته‌ای.',noContacts:'برای ساخت فاکتور، اول یک مشتری در CRM ثبت کن.',dueOn:'موعد',status:{draft:'پیش‌نویس',sent:'ارسال‌شده',paid:'پرداخت‌شده',overdue:'سررسیدگذشته',cancelled:'لغوشده'}},
 en:{title:'Invoices',locked:'Not available for your current plan or role; it needs the CRM add-on or workspace manager access.',currency:'Currency (no conversion)',new:'New invoice',save:'Save draft',newTitle:'Invoice draft',editTitle:'Edit draft',cancel:'Cancel',contact:'Customer',description:'Description',quantity:'Qty',price:'Unit price',tax:'Tax %',discount:'Discount',notes:'Notes',add:'Add line',remove:'Remove line',due:'Due date',noDue:'No due date',setDue:'Set due date',total:'Total',line:(n:string)=>`Line ${n}`,hint:'A draft is not sent to the customer and records no payment. Amounts are in this currency.',all:'All',drafts:'Drafts',empty:'No invoices yet.',noContacts:'Add a customer in CRM first to create an invoice.',dueOn:'Due',status:{draft:'Draft',sent:'Sent',paid:'Paid',overdue:'Overdue',cancelled:'Cancelled'}},
 tr:{title:'Faturalar',locked:'Mevcut paketin veya rolün için açık değil; CRM eklentisi ya da çalışma alanı yöneticisi yetkisi gerekir.',currency:'Para birimi (dönüştürme yok)',new:'Yeni fatura',save:'Taslağı kaydet',newTitle:'Fatura taslağı',editTitle:'Taslağı düzenle',cancel:'Vazgeç',contact:'Müşteri',description:'Açıklama',quantity:'Adet',price:'Birim fiyat',tax:'Vergi %',discount:'İndirim',notes:'Notlar',add:'Satır ekle',remove:'Satırı kaldır',due:'Son ödeme',noDue:'Son tarih yok',setDue:'Son tarih belirle',total:'Toplam',line:(n:string)=>`Satır ${n}`,hint:'Taslak müşteriye gönderilmez ve ödeme kaydetmez. Tutarlar bu para birimindedir.',all:'Tümü',drafts:'Taslak',empty:'Henüz fatura yok.',noContacts:'Fatura için önce CRM’e bir müşteri ekle.',dueOn:'Vade',status:{draft:'Taslak',sent:'Gönderildi',paid:'Ödendi',overdue:'Gecikmiş',cancelled:'İptal'}},
} as const;
type Line={description:string;quantity:string;unitPrice:string;taxRate:string};
type Currency=z.infer<typeof schema>['invoices'][number]['currency'];
const currencies=['IRT','IRR','USD','GBP','EUR','TRY'] as const;
const blank=():Line=>({description:'',quantity:'1',unitPrice:'0',taxRate:'0'});
const numeric=(value:string)=>Number(value.replace(/[۰-۹٠-٩]/g,char=>String('۰۱۲۳۴۵۶۷۸۹'.includes(char)?'۰۱۲۳۴۵۶۷۸۹'.indexOf(char):'٠١٢٣٤٥٦٧٨٩'.indexOf(char))));

export function InvoiceManager({locale,onError}:{locale:Locale;onError:(e:unknown)=>void}){
 const {c,rtl}=useTheme();const t=copy[locale],admitted=useRef<{hash:string;key:string}|null>(null);
 const [catalog,setCatalog]=useState<z.infer<typeof schema>|null>(null),[context,setContext]=useState<z.infer<typeof schema>['context']|null>(null),[editing,setEditing]=useState<{id:string;version:string}|null>(null),[show,setShow]=useState(false),[lines,setLines]=useState<Line[]>([blank()]),[contactId,setContactId]=useState(''),[currency,setCurrency]=useState<Currency>('IRT'),[discount,setDiscount]=useState('0'),[notes,setNotes]=useState(''),[due,setDue]=useState(false),[date,setDate]=useState(()=>new Date()),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0),[filter,setFilter]=useState<'all'|'draft'>('all'),[locked,setLocked]=useState(false);
 useEffect(()=>{let active=true;request('/api/mobile/v1/invoices',locale).then(raw=>{if(active)setCatalog(schema.parse(raw));}).catch(error=>{if(!active)return;if(error instanceof ApiError&&(error.status===402||error.status===403))setLocked(true);else onError(error);});return()=>{active=false;};},[locale,revision,onError]);
 const items=lines.map(row=>({description:row.description,quantity:numeric(row.quantity),unitPrice:numeric(row.unitPrice),taxRate:numeric(row.taxRate)}));
 const total=items.reduce((sum,row)=>sum+row.quantity*row.unitPrice*(1+row.taxRate/100),0)-numeric(discount);
 const valid=!!contactId&&Number.isFinite(total)&&total>=0&&total<=1e12&&Number.isFinite(numeric(discount))&&numeric(discount)>=0&&items.every(row=>row.description.trim()&&Number.isFinite(row.quantity)&&row.quantity>0&&row.quantity<=1e6&&Number.isFinite(row.unitPrice)&&row.unitPrice>=0&&row.unitPrice<=1e12&&Number.isFinite(row.taxRate)&&row.taxRate>=0&&row.taxRate<=100);
 async function save(){if(busy||!context||!valid)return;setBusy(true);try{const input={action:editing?'update':'create',context,...(editing||{}),data:{contactId,items,discount:numeric(discount),currency,notes,dueDate:due?date.toISOString():null}};const hash=JSON.stringify(input);if(admitted.current?.hash!==hash)admitted.current={hash,key:'invoice_'+randomUUID()};await request('/api/mobile/v1/invoices',locale,{method:'POST',body:JSON.stringify({...input,requestKey:admitted.current.key})});admitted.current=null;setShow(false);setRevision(value=>value+1);}catch(error){onError(error);}finally{setBusy(false);}}
 const fmt=(n:number)=>new Intl.NumberFormat(locale==='fa'?'fa-IR':locale,{maximumFractionDigits:2}).format(n);
 const when=(iso:string)=>new Intl.DateTimeFormat(locale==='fa'?'fa-IR':locale,{dateStyle:'medium'}).format(new Date(iso));
 const label=(s:string)=>(t.status as Record<string,string>)[s]??s;
 const contactName=(id:string)=>catalog?.contacts.find(x=>x.id===id)?.name??'';
 const all=catalog?.invoices??[];const shown=filter==='draft'?all.filter(i=>i.status==='draft'):all;
 const startNew=()=>{setEditing(null);setContext(catalog!.context);setLines([blank()]);setContactId('');setCurrency('IRT');setDiscount('0');setNotes('');setDue(false);setShow(true);};
 const edit=(invoice:z.infer<typeof schema>['invoices'][number])=>{setEditing({id:invoice.id,version:invoice.version});setContext(catalog!.context);setContactId(invoice.contactId);setCurrency(invoice.currency);setDiscount(String(invoice.discount));setNotes(invoice.notes||'');setDue(!!invoice.dueDate);setDate(invoice.dueDate?new Date(invoice.dueDate):new Date());setLines(invoice.items.map(row=>({description:row.description,quantity:String(row.quantity),unitPrice:String(row.unitPrice),taxRate:String(row.taxRate)})));setShow(true);};
 const setLine=(index:number,field:keyof Line,value:string)=>setLines(current=>current.map((line,i)=>i===index?{...line,[field]:value}:line));
 return <View style={{gap:space.md}}>
  <Row justify="space-between"><AppText variant="title" weight="bold" accessibilityRole="header">{t.title}</AppText>{locked?null:<Button label={t.new} icon="add" disabled={busy||!catalog||!catalog.contacts.length} onPress={startNew}/>}</Row>
  {catalog&&!catalog.contacts.length?<AppText variant="caption" tone="muted">{t.noContacts}</AppText>:null}
  {all.length?<Row gap={space.sm}><StatTile icon="document-text-outline" value={numberFormat(locale,all.length)} label={t.all}/><StatTile icon="create-outline" value={numberFormat(locale,all.filter(i=>i.status==='draft').length)} label={t.drafts}/></Row>:null}
  {all.length?<Options value={filter} onChange={setFilter} options={[{value:'all',label:t.all},{value:'draft',label:t.drafts}]}/>:null}
  {locked?<View style={[s.empty,{backgroundColor:c.surface}]}><Icon name="lock-closed-outline" size={28} color={c.accent}/><AppText tone="muted" align="center">{t.locked}</AppText></View>:!catalog?<ActivityIndicator color={c.accent}/>:!all.length?<View style={[s.empty,{backgroundColor:c.surface}]}><Icon name="receipt-outline" size={30} color={c.accent}/><AppText tone="muted" align="center">{t.empty}</AppText></View>:null}
  {shown.map(invoice=><Card key={invoice.id} accessibilityLabel={invoice.invoiceNumber} onPress={invoice.status==='draft'?()=>edit(invoice):undefined}>
   <Row gap={space.md}>
    <View style={[s.icon,{backgroundColor:c.soft}]}><Icon name="receipt-outline" size={20} color={c.accent}/></View>
    <View style={{flex:1,gap:2}}><AppText weight="bold">{invoice.invoiceNumber}</AppText><AppText variant="caption" tone="muted" numberOfLines={1}>{contactName(invoice.contactId)}{invoice.dueDate?` · ${t.dueOn} ${when(invoice.dueDate)}`:''}</AppText></View>
    <View style={{alignItems:rtl?'flex-start':'flex-end',gap:4}}><AppText weight="bold" tone="accent">{fmt(invoice.total)} {invoice.currency}</AppText><Chip tone={invoice.status==='draft'?'raised':'soft'} label={label(invoice.status)}/></View>
   </Row>
  </Card>)}
  <Sheet visible={show} onClose={()=>setShow(false)} title={editing?t.editTitle:t.newTitle}>
   <Labeled label={t.contact}><Options scroll value={contactId||null} disabled={busy} onChange={setContactId} options={(catalog?.contacts??[]).map(x=>({value:x.id,label:x.name}))}/></Labeled>
   <Labeled label={t.currency}><Options value={currency} disabled={busy} onChange={setCurrency} options={currencies.map(v=>({value:v,label:v}))}/></Labeled>
   {lines.map((row,index)=><View key={index} style={[s.line,{backgroundColor:c.raised}]}>
    <Row justify="space-between"><AppText variant="caption" weight="bold" tone="muted">{t.line(numberFormat(locale,index+1))}</AppText>{lines.length>1?<IconButton icon="trash-outline" label={t.remove} size={32} onPress={()=>setLines(current=>current.filter((_,i)=>i!==index))}/>:null}</Row>
    <Field accessibilityLabel={t.description} placeholder={t.description} value={row.description} onChangeText={v=>setLine(index,'description',v)} maxLength={500} editable={!busy} style={{backgroundColor:c.surface}}/>
    <Row gap={space.sm}>
     {(['quantity','unitPrice','taxRate'] as const).map(field=><View key={field} style={{flex:field==='unitPrice'?2:1}}><Labeled label={field==='unitPrice'?t.price:field==='taxRate'?t.tax:t.quantity}><Field accessibilityLabel={field} value={row[field]} onChangeText={v=>setLine(index,field,v)} keyboardType="decimal-pad" maxLength={18} editable={!busy} style={{backgroundColor:c.surface,textAlign:'left',writingDirection:'ltr'}}/></Labeled></View>)}
    </Row>
   </View>)}
   <Button label={t.add} icon="add" variant="ghost" disabled={busy||lines.length>=50} onPress={()=>setLines(current=>[...current,blank()])}/>
   <Labeled label={t.discount}><Field accessibilityLabel={t.discount} value={discount} onChangeText={setDiscount} keyboardType="decimal-pad" maxLength={18} editable={!busy} style={{textAlign:'left',writingDirection:'ltr'}}/></Labeled>
   <Labeled label={t.notes}><Field accessibilityLabel={t.notes} value={notes} onChangeText={setNotes} maxLength={4000} editable={!busy} multiline style={{minHeight:72,textAlignVertical:'top'}}/></Labeled>
   <Labeled label={t.due}><Options value={due?'set':'none'} disabled={busy} onChange={v=>setDue(v==='set')} options={[{value:'none',label:t.noDue},{value:'set',label:t.setDue}]}/></Labeled>
   {due?<DateTimeField locale={locale} color={c.text} value={date} onChange={setDate} disabled={busy}/>:null}
   <View style={[s.total,{backgroundColor:c.soft}]}><Row justify="space-between"><AppText weight="bold" tone="softText">{t.total}</AppText><AppText variant="title" weight="bold" tone="softText">{Number.isFinite(total)?fmt(total):'—'} {currency}</AppText></Row></View>
   <AppText variant="tiny" tone="faint">{t.hint}</AppText>
   <Button label={t.save} icon="checkmark" busy={busy} disabled={!valid} onPress={()=>void save()}/>
   <Button label={t.cancel} variant="ghost" onPress={()=>setShow(false)}/>
  </Sheet>
 </View>;
}
const s=StyleSheet.create({
 icon:{width:44,height:44,borderRadius:14,alignItems:'center',justifyContent:'center'},
 empty:{borderRadius:radius.lg,padding:space.xl,alignItems:'center',gap:space.sm},
 line:{borderRadius:radius.md,padding:space.md,gap:space.sm},
 total:{borderRadius:radius.md,padding:space.md},
});
