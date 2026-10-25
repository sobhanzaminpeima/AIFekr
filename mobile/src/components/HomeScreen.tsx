import {useEffect,useState} from 'react';
import {Pressable,StyleSheet,TextInput,View} from 'react-native';
import {z} from 'zod';
import {request} from '../api';
import type {Locale} from '../i18n';
import type {Purpose} from '../preferences';
import {fonts,radius,space,type} from '../design';
import {AppText,Card,Chip,Icon,IconButton,Row,tap,type IconName} from '../ui/kit';
import {FikaAvatar,GradientCard,StatTile} from '../ui/brand';
import {numberFormat,useTheme} from '../ui/theme';

export type HomeTarget='fika'|'create'|'work'|'student'|'fitness'|'you';
const copy={
 fa:{greet:['شب بخیر','صبح بخیر','ظهر بخیر','عصر بخیر'],sub:'امروز را با هم جلو ببریم.',fika:'فیکا، دستیار هوشمند تو',fikaSub:'بپرس، بنویس یا کاری بسپار',ask:'از فیکا بپرس…',credits:'اعتبار',chats:'گفت‌وگو',leads:'مشتری جدید',tasks:'پیگیری امروز',today:'امروز',recent:'گفت‌وگوهای اخیر',all:'همه',hub:'همه‌چیز در یک اپ',empty:'هنوز گفت‌وگویی نداری. اولین سؤالت را از فیکا بپرس.',send:'ارسال',voice:'ورودی صوتی',camera:'دوربین',notifications:'اعلان‌ها',
  prompts:{personal:['یک برنامهٔ هفتگی برایم بچین','این متن را روان‌تر کن','ایدهٔ هدیه برای تولد'],student:['این مبحث را ساده توضیح بده','از این فصل کوییز بساز','برنامهٔ مطالعهٔ امتحان بچین'],business:['پیگیری لیدهای امروز','کپشن اینستاگرام برای محصول','متن پیامک تخفیف'],fitness:['برنامهٔ تمرین ۳ روزه','گرم‌کردن قبل از دویدن','تمرین در خانه بدون وسیله'],realestate:['متن آگهی آپارتمان','پاسخ به مشتری مردد','چک‌لیست بازدید ملک']},
  modules:{fika:'چت هوشمند',create:'استودیو',work:'CRM و کسب‌وکار',student:'دانشجو',fitness:'FIT',you:'حساب و اعتبار'}},
 en:{greet:['Good night','Good morning','Good afternoon','Good evening'],sub:"Let's move today forward.",fika:'FIKA, your AI assistant',fikaSub:'Ask, write or hand over a task',ask:'Ask FIKA…',credits:'credits',chats:'chats',leads:'new contacts',tasks:'due today',today:'Today',recent:'Recent chats',all:'All',hub:'Everything in one app',empty:'No chats yet. Ask FIKA your first question.',send:'Send',voice:'Voice input',camera:'Camera',notifications:'Notifications',
  prompts:{personal:['Plan my week','Make this text clearer','Birthday gift ideas'],student:['Explain this topic simply','Quiz me on this chapter','Plan my exam study'],business:["Follow up today's leads",'Instagram caption for a product','Discount SMS copy'],fitness:['3-day workout plan','Warm-up before running','No-equipment home workout'],realestate:['Apartment listing copy','Reply to a hesitant buyer','Property viewing checklist']},
  modules:{fika:'AI chat',create:'Studio',work:'CRM and business',student:'Student',fitness:'FIT',you:'Account and credits'}},
 tr:{greet:['İyi geceler','Günaydın','Tünaydın','İyi akşamlar'],sub:'Bugünü birlikte ilerletelim.',fika:'FIKA, yapay zekâ asistanın',fikaSub:'Sor, yaz ya da bir iş ver',ask:'FIKA’ya sor…',credits:'kredi',chats:'sohbet',leads:'yeni kişi',tasks:'bugünkü takip',today:'Bugün',recent:'Son sohbetler',all:'Tümü',hub:'Her şey tek uygulamada',empty:'Henüz sohbet yok. FIKA’ya ilk sorunu sor.',send:'Gönder',voice:'Sesli giriş',camera:'Kamera',notifications:'Bildirimler',
  prompts:{personal:['Haftamı planla','Bu metni akıcı yap','Doğum günü hediye fikirleri'],student:['Bu konuyu basitçe anlat','Bu bölümden test hazırla','Sınav çalışma planı'],business:['Bugünkü adayları takip et','Ürün için Instagram metni','İndirim SMS metni'],fitness:['3 günlük antrenman planı','Koşu öncesi ısınma','Ekipmansız ev antrenmanı'],realestate:['Daire ilan metni','Kararsız müşteriye yanıt','Ev gezme kontrol listesi']},
  modules:{fika:'Yapay zekâ sohbet',create:'Stüdyo',work:'CRM ve iş',student:'Öğrenci',fitness:'FIT',you:'Hesap ve kredi'}},
} as const;
const moduleIcons:Record<HomeTarget,IconName>={fika:'chatbubbles-outline',create:'color-wand-outline',work:'briefcase-outline',student:'school-outline',fitness:'barbell-outline',you:'wallet-outline'};
const listSchema=z.object({conversations:z.array(z.object({id:z.string(),title:z.string()}))});
const toolSchema=z.object({data:z.object({contacts:z.array(z.unknown()).optional(),tasks:z.array(z.unknown()).optional()})});

export function HomeScreen({locale,account,purpose,onAsk,onOpen,onOpenChat,fitnessOnly}:{locale:Locale;account:{name:string;plan:string;displayCredits:number}|null;purpose?:Purpose;onAsk:(prompt:string)=>void;onOpen:(target:HomeTarget)=>void;onOpenChat:(id:string)=>void;fitnessOnly?:boolean}){
 const {c,rtl}=useTheme();const t=copy[locale];
 const [draft,setDraft]=useState('');const [recent,setRecent]=useState<{id:string;title:string}[]>([]);const [chatCount,setChatCount]=useState<number|null>(null);
 // Business counts come from the free FIKA read tools; accounts without CRM access get 402/403 and the tiles stay hidden.
 const [leads,setLeads]=useState<number|null>(null),[tasks,setTasks]=useState<number|null>(null);
 useEffect(()=>{let active=true;request('/api/mobile/v1/conversations',locale).then(raw=>{if(!active)return;const list=listSchema.parse(raw).conversations;setRecent(list.slice(0,3));setChatCount(list.length);}).catch(()=>{});return()=>{active=false;};},[locale]);
 useEffect(()=>{if(fitnessOnly)return;let active=true;
  request('/api/mobile/v1/fika/tools?tool=recentContacts',locale).then(raw=>{if(active)setLeads(toolSchema.parse(raw).data.contacts?.length??0);}).catch(()=>{});
  request('/api/mobile/v1/fika/tools?tool=followUpsDue',locale).then(raw=>{if(active)setTasks(toolSchema.parse(raw).data.tasks?.length??0);}).catch(()=>{});
  return()=>{active=false;};},[locale,fitnessOnly]);
 const submit=()=>{const value=draft.trim();if(!value)return;setDraft('');onAsk(value);};
 const first=account?.name?.split(' ')[0];const hour=new Date().getHours();
 const greet=t.greet[hour<5?0:hour<12?1:hour<17?2:3];
 const modules:HomeTarget[]=fitnessOnly?['fitness','you']:['fika','create','work','student','fitness','you'];
 const initial=(first||'A').slice(0,1).toUpperCase();
 return <View style={{gap:space.xl}}>
  <Row justify="space-between">
   <Row gap={space.md}>
    <View style={[s.avatar,{backgroundColor:c.raised,borderColor:c.accent}]}><AppText weight="bold" align="center">{initial}</AppText></View>
    <View><AppText variant="caption" tone="muted">{greet}</AppText><AppText variant="title" weight="bold" accessibilityRole="header">{first??''}</AppText></View>
   </Row>
   <IconButton icon="notifications-outline" label={t.notifications} tone="raised" onPress={()=>onOpen('you')}/>
  </Row>
  {!fitnessOnly?<GradientCard>
   <Row gap={space.md}>
    <FikaAvatar size={54} mood="smile"/>
    <View style={{flex:1}}><AppText weight="bold">{t.fika}</AppText><AppText variant="caption" tone="muted">{t.fikaSub}</AppText></View>
   </Row>
   <View style={[s.composer,{backgroundColor:c.bg}]}>
    <TextInput accessibilityLabel={t.ask} placeholder={t.ask} placeholderTextColor={c.faint} value={draft} onChangeText={setDraft} multiline maxLength={12000}
     style={[type.body,{fontFamily:fonts.regular,color:c.text,minHeight:44,maxHeight:120,textAlign:rtl?'right':'left',writingDirection:rtl?'rtl':'ltr'}]}/>
    <Row justify="space-between">
     <Row gap={2}><IconButton icon="mic-outline" label={t.voice} onPress={()=>onAsk('')}/><IconButton icon="camera-outline" label={t.camera} onPress={()=>onOpen('create')}/></Row>
     <IconButton icon="arrow-up" tone="accent" label={t.send} disabled={!draft.trim()} onPress={submit}/>
    </Row>
   </View>
   <View style={{flexDirection:rtl?'row-reverse':'row',flexWrap:'wrap',gap:space.sm}}>{t.prompts[purpose??'personal'].map(p=><Chip key={p} tone="raised" label={p} onPress={()=>onAsk(p)}/>)}</View>
  </GradientCard>:null}
  <View style={{gap:space.sm}}>
   <AppText variant="caption" weight="bold" tone="muted">{t.today}</AppText>
   <View style={{flexDirection:rtl?'row-reverse':'row',gap:space.sm,flexWrap:'wrap'}}>
    <StatTile icon="flash-outline" value={account?numberFormat(locale,account.displayCredits):'…'} label={t.credits} onPress={()=>onOpen('you')}/>
    {leads!==null?<StatTile icon="person-add-outline" value={numberFormat(locale,leads)} label={t.leads} onPress={()=>onOpen('work')}/>:null}
    {tasks!==null?<StatTile icon="alarm-outline" value={numberFormat(locale,tasks)} label={t.tasks} onPress={()=>onOpen('work')}/>:null}
    {leads===null&&chatCount!==null?<StatTile icon="chatbubbles-outline" value={numberFormat(locale,chatCount)} label={t.chats} onPress={()=>onOpen('fika')}/>:null}
   </View>
  </View>
  <View style={{gap:space.sm}}>
   <AppText variant="title" weight="bold">{t.hub}</AppText>
   <View style={[s.grid,{flexDirection:rtl?'row-reverse':'row'}]}>{modules.map(target=><Pressable key={target} accessibilityRole="button" accessibilityLabel={t.modules[target]} onPress={()=>{tap();onOpen(target);}} style={({pressed})=>[s.module,{backgroundColor:c.surface,opacity:pressed?.85:1}]}>
    <View style={[s.moduleIcon,{backgroundColor:c.soft}]}><Icon name={moduleIcons[target]} size={22} color={c.accent}/></View>
    <AppText variant="caption" weight="medium" align="center" numberOfLines={1}>{t.modules[target]}</AppText>
   </Pressable>)}</View>
  </View>
  {!fitnessOnly?<View style={{gap:space.sm}}>
   <Row justify="space-between"><AppText variant="title" weight="bold">{t.recent}</AppText>{recent.length?<Pressable accessibilityRole="button" onPress={()=>onOpen('fika')} hitSlop={8}><AppText variant="caption" tone="accent">{t.all}</AppText></Pressable>:null}</Row>
   {recent.length?recent.map(item=><Card key={item.id} onPress={()=>onOpenChat(item.id)} accessibilityLabel={item.title} style={s.recent}>
    <Row gap={space.md}><FikaAvatar size={30} ring={false} mood="neutral"/><AppText numberOfLines={1} style={{flex:1}}>{item.title}</AppText><Icon name="chevron-forward" size={16} color={c.faint} mirror/></Row>
   </Card>):<AppText tone="muted" variant="caption">{t.empty}</AppText>}
  </View>:null}
 </View>;
}
const s=StyleSheet.create({
 avatar:{width:44,height:44,borderRadius:22,borderWidth:2,alignItems:'center',justifyContent:'center'},
 composer:{borderRadius:radius.md,padding:space.sm,gap:space.xs},
 recent:{paddingVertical:space.md},
 grid:{flexWrap:'wrap',gap:space.sm},
 module:{flexBasis:'31%',flexGrow:1,borderRadius:radius.md,paddingVertical:space.lg,paddingHorizontal:space.sm,alignItems:'center',gap:space.sm},
 moduleIcon:{width:46,height:46,borderRadius:16,alignItems:'center',justifyContent:'center'},
});
