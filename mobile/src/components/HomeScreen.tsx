import {useEffect,useState} from 'react';
import {Pressable,StyleSheet,TextInput,View} from 'react-native';
import {z} from 'zod';
import {request} from '../api';
import type {Locale} from '../i18n';
import type {Purpose} from '../preferences';
import {fonts,radius,space,type} from '../design';
import {AppText,Card,Chip,Icon,IconButton,Row,type IconName} from '../ui/kit';
import {numberFormat,useTheme} from '../ui/theme';

export type HomeTarget='fika'|'create'|'work'|'student'|'fitness'|'you';
const copy={
 fa:{hello:'سلام',ask:'از فیکا بپرس یا کاری بسپار…',credits:'اعتبار',recent:'گفت‌وگوهای اخیر',all:'همه',hub:'فضاهای کار',empty:'هنوز گفت‌وگویی نداری. اولین سؤالت را بپرس.',send:'ارسال',voice:'ورودی صوتی',camera:'دوربین',
  prompts:{personal:['یک برنامهٔ هفتگی برایم بچین','این متن را روان‌تر کن','ایدهٔ هدیه برای تولد'],student:['این مبحث را ساده توضیح بده','از این فصل کوییز بساز','برنامهٔ مطالعهٔ امتحان بچین'],business:['پیگیری لیدهای امروز','کپشن اینستاگرام برای محصول','متن پیامک تخفیف'],fitness:['برنامهٔ تمرین ۳ روزه','گرم‌کردن قبل از دویدن','تمرین در خانه بدون وسیله'],realestate:['متن آگهی آپارتمان','پاسخ به مشتری مردد','چک‌لیست بازدید ملک']},
  modules:{fika:['فیکا','گفت‌وگو و اقدام'],create:['استودیو','تصویر، ویدیو، موسیقی'],work:['کسب‌وکار','مشتریان و پیگیری'],student:['دانشجو','درس و کوییز'],fitness:['FIT','تمرین و مربی'],you:['حساب','اعتبار و امنیت']}},
 en:{hello:'Hi',ask:'Ask FIKA or hand it a task…',credits:'credits',recent:'Recent chats',all:'All',hub:'Workspaces',empty:'No chats yet. Ask your first question.',send:'Send',voice:'Voice input',camera:'Camera',
  prompts:{personal:['Plan my week','Make this text clearer','Birthday gift ideas'],student:['Explain this topic simply','Quiz me on this chapter','Plan my exam study'],business:["Follow up today's leads",'Instagram caption for a product','Discount SMS copy'],fitness:['3-day workout plan','Warm-up before running','No-equipment home workout'],realestate:['Apartment listing copy','Reply to a hesitant buyer','Property viewing checklist']},
  modules:{fika:['FIKA','Chat and actions'],create:['Studio','Image, video, music'],work:['Business','Clients and follow-ups'],student:['Student','Courses and quizzes'],fitness:['FIT','Training and coach'],you:['Account','Credits and security']}},
 tr:{hello:'Merhaba',ask:'FIKA’ya sor veya bir iş ver…',credits:'kredi',recent:'Son sohbetler',all:'Tümü',hub:'Çalışma alanları',empty:'Henüz sohbet yok. İlk sorunu sor.',send:'Gönder',voice:'Sesli giriş',camera:'Kamera',
  prompts:{personal:['Haftamı planla','Bu metni akıcı yap','Doğum günü hediye fikirleri'],student:['Bu konuyu basitçe anlat','Bu bölümden test hazırla','Sınav çalışma planı'],business:['Bugünkü adayları takip et','Ürün için Instagram metni','İndirim SMS metni'],fitness:['3 günlük antrenman planı','Koşu öncesi ısınma','Ekipmansız ev antrenmanı'],realestate:['Daire ilan metni','Kararsız müşteriye yanıt','Ev gezme kontrol listesi']},
  modules:{fika:['FIKA','Sohbet ve işlemler'],create:['Stüdyo','Görsel, video, müzik'],work:['İş','Müşteriler ve takip'],student:['Öğrenci','Dersler ve testler'],fitness:['FIT','Antrenman ve koç'],you:['Hesap','Kredi ve güvenlik']}},
} as const;
const moduleIcons:Record<HomeTarget,IconName>={fika:'sparkles-outline',create:'color-wand-outline',work:'briefcase-outline',student:'school-outline',fitness:'barbell-outline',you:'person-circle-outline'};
const listSchema=z.object({conversations:z.array(z.object({id:z.string(),title:z.string()}))});

export function HomeScreen({locale,account,purpose,onAsk,onOpen,onOpenChat,fitnessOnly}:{locale:Locale;account:{name:string;plan:string;displayCredits:number}|null;purpose?:Purpose;onAsk:(prompt:string)=>void;onOpen:(target:HomeTarget)=>void;onOpenChat:(id:string)=>void;fitnessOnly?:boolean}){
 const {c,rtl}=useTheme();const t=copy[locale];
 const [draft,setDraft]=useState('');const [recent,setRecent]=useState<{id:string;title:string}[]>([]);
 useEffect(()=>{let active=true;request('/api/mobile/v1/conversations',locale).then(raw=>{if(active)setRecent(listSchema.parse(raw).conversations.slice(0,4));}).catch(()=>{});return()=>{active=false;};},[locale]);
 const submit=()=>{const value=draft.trim();if(!value)return;setDraft('');onAsk(value);};
 const first=account?.name?.split(' ')[0];
 const modules:HomeTarget[]=fitnessOnly?['fitness','you']:['fika','create','work','student','fitness','you'];
 return <View style={{gap:space.xl}}>
  <Row justify="space-between">
   <AppText variant="display" weight="bold" accessibilityRole="header">{t.hello}{first?`، ${first}`:''}</AppText>
   {account?<Chip icon="flash-outline" label={`${numberFormat(locale,account.displayCredits)} ${t.credits}`} onPress={()=>onOpen('you')}/>:null}
  </Row>
  {!fitnessOnly?<View style={[s.composer,{backgroundColor:c.surface}]}>
   <TextInput accessibilityLabel={t.ask} placeholder={t.ask} placeholderTextColor={c.faint} value={draft} onChangeText={setDraft} multiline maxLength={12000} onSubmitEditing={submit}
    style={[type.body,{fontFamily:fonts.regular,color:c.text,minHeight:56,textAlign:rtl?'right':'left',writingDirection:rtl?'rtl':'ltr'}]}/>
   <Row justify="space-between">
    <Row gap={2}><IconButton icon="camera-outline" label={t.camera} onPress={()=>onOpen('create')}/><IconButton icon="mic-outline" label={t.voice} onPress={()=>onAsk('')}/></Row>
    <IconButton icon="arrow-up" tone="accent" label={t.send} disabled={!draft.trim()} onPress={submit}/>
   </Row>
  </View>:null}
  {!fitnessOnly?<View style={{flexDirection:rtl?'row-reverse':'row',flexWrap:'wrap',gap:space.sm}}>{t.prompts[purpose??'personal'].map(p=><Chip key={p} tone="raised" label={p} onPress={()=>onAsk(p)}/>)}</View>:null}
  {!fitnessOnly?<View style={{gap:space.sm}}>
   <Row justify="space-between"><AppText variant="title" weight="bold">{t.recent}</AppText>{recent.length?<Pressable accessibilityRole="button" onPress={()=>onOpen('fika')} hitSlop={8}><AppText variant="caption" tone="accent">{t.all}</AppText></Pressable>:null}</Row>
   {recent.length?recent.map(item=><Card key={item.id} onPress={()=>onOpenChat(item.id)} accessibilityLabel={item.title} style={s.recent}>
    <Row gap={space.md}><Icon name="chatbubble-ellipses-outline" size={18} color={c.muted}/><AppText numberOfLines={1} style={{flex:1}}>{item.title}</AppText><Icon name="chevron-forward" size={16} color={c.faint} mirror/></Row>
   </Card>):<AppText tone="muted" variant="caption">{t.empty}</AppText>}
  </View>:null}
  <View style={{gap:space.sm}}>
   <AppText variant="title" weight="bold">{t.hub}</AppText>
   <View style={[s.grid,{flexDirection:rtl?'row-reverse':'row'}]}>{modules.map(target=><Card key={target} onPress={()=>onOpen(target)} accessibilityLabel={t.modules[target][0]} style={s.module}>
    <View style={[s.moduleIcon,{backgroundColor:c.soft}]}><Icon name={moduleIcons[target]} size={22} color={c.accent}/></View>
    <AppText weight="bold">{t.modules[target][0]}</AppText><AppText variant="caption" tone="muted">{t.modules[target][1]}</AppText>
   </Card>)}</View>
  </View>
 </View>;
}
const s=StyleSheet.create({
 composer:{borderRadius:radius.lg,padding:space.md,gap:space.sm},
 recent:{paddingVertical:space.md},
 grid:{flexWrap:'wrap',gap:space.md},
 module:{flexGrow:1,flexBasis:'30%',minWidth:140,minHeight:128},
 moduleIcon:{width:42,height:42,borderRadius:14,alignItems:'center',justifyContent:'center',marginBottom:space.xs},
});
