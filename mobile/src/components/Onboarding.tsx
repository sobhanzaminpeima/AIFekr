import {useEffect,useRef,useState} from 'react';
import {KeyboardAvoidingView,Platform,Pressable,ScrollView,StyleSheet,TextInput,View} from 'react-native';
import {ApiError,apiConfigurationError,request,requestOtp,signIn,verifyOtp} from '../api';
import type {Locale} from '../i18n';
import {purposes,updatePreferences,type Purpose} from '../preferences';
import {fonts,radius,space} from '../design';
import {AppText,Banner,Button,Chip,Field,Icon,IconButton,Row,success,type IconName} from '../ui/kit';
import {numberFormat,useTheme} from '../ui/theme';

const copy={
 fa:{skip:'رد شدن',next:'بعدی',start:'شروع کنیم',slides:[['sparkles-outline','فیکا؛ دستیاری که کار را انجام می‌دهد','بپرس، بنویس، بساز؛ و اگر کاری لازم بود، با تأیید تو انجامش بده.'],['wifi-outline','بدون فیلترشکن','همه‌چیز از طریق aifekr.com؛ هوش مصنوعی روز دنیا، از داخل ایران.'],['wallet-outline','هزینه همیشه معلوم','قبل از هر پیام می‌بینی چقدر اعتبار مصرف می‌شود. بدون هزینهٔ پنهان.']],phoneTitle:'ورود یا ثبت‌نام',phoneHint:'شمارهٔ موبایلت را وارد کن؛ کد تأیید پیامک می‌شود.',phone:'شمارهٔ موبایل',cont:'ادامه',email:'ورود با ایمیل و رمز',codeTitle:'کد تأیید',codeHint:(p:string)=>`کد ارسال‌شده به ${p} را وارد کن.`,resendIn:(s:string)=>`ارسال دوباره تا ${s} ثانیه`,resend:'ارسال دوباره کد',change:'تغییر شماره',profileTitle:'خوش آمدی!',profileHint:'چه صدایت کنیم؟ و بیشتر برای چه کاری آمده‌ای؟',name:'نام',purpose:{personal:'استفادهٔ شخصی',student:'درس و دانشگاه',business:'کسب‌وکار',fitness:'تمرین و سلامتی',realestate:'املاک'},done:'ورود به AIFekr',emailTitle:'ورود با ایمیل',password:'رمز عبور',login:'ورود',back:'بازگشت',invalidPhone:'شمارهٔ موبایل معتبر نیست؛ مثل ۰۹۱۲۳۴۵۶۷۸۹.',error:'ارتباط برقرار نشد. دوباره تلاش کنید.',gift:'بدون فیلترشکن کار می‌کند'},
 en:{skip:'Skip',next:'Next',start:"Let's start",slides:[['sparkles-outline','FIKA gets things done','Ask, write and create. When something needs doing, FIKA does it after you approve.'],['wifi-outline','Works without a VPN','Everything goes through aifekr.com: frontier AI, reachable from Iran.'],['wallet-outline','Cost is always visible','See how many credits a message uses before you send it. No hidden charges.']],phoneTitle:'Sign in or sign up',phoneHint:'Enter your mobile number and we will text you a code.',phone:'Mobile number',cont:'Continue',email:'Sign in with email and password',codeTitle:'Verification code',codeHint:(p:string)=>`Enter the code sent to ${p}.`,resendIn:(s:string)=>`Resend in ${s}s`,resend:'Resend code',change:'Change number',profileTitle:'Welcome!',profileHint:'What should we call you, and what brings you here?',name:'Name',purpose:{personal:'Personal use',student:'Study',business:'Business',fitness:'Fitness',realestate:'Real estate'},done:'Enter AIFekr',emailTitle:'Sign in with email',password:'Password',login:'Sign in',back:'Back',invalidPhone:'Enter a valid Iranian mobile number, like 09123456789.',error:'Could not connect. Try again.',gift:'Works without a VPN'},
 tr:{skip:'Geç',next:'İleri',start:'Başlayalım',slides:[['sparkles-outline','FIKA işi halleder','Sor, yaz, üret. Bir işlem gerekiyorsa onayınla yapar.'],['wifi-outline','VPN gerekmez','Her şey aifekr.com üzerinden çalışır.'],['wallet-outline','Maliyet her zaman görünür','Göndermeden önce bir mesajın kaç kredi kullanacağını görürsün.']],phoneTitle:'Giriş veya kayıt',phoneHint:'Cep numaranı gir, kodu SMS ile gönderelim.',phone:'Cep numarası',cont:'Devam',email:'E-posta ve şifre ile giriş',codeTitle:'Doğrulama kodu',codeHint:(p:string)=>`${p} numarasına gönderilen kodu gir.`,resendIn:(s:string)=>`${s} sn sonra tekrar gönder`,resend:'Kodu tekrar gönder',change:'Numarayı değiştir',profileTitle:'Hoş geldin!',profileHint:'Sana nasıl hitap edelim, en çok ne için kullanacaksın?',name:'Ad',purpose:{personal:'Kişisel',student:'Eğitim',business:'İş',fitness:'Fitness',realestate:'Emlak'},done:"AIFekr'e gir",emailTitle:'E-posta ile giriş',password:'Şifre',login:'Giriş yap',back:'Geri',invalidPhone:'Geçerli bir İran cep numarası gir.',error:'Bağlantı kurulamadı. Tekrar dene.',gift:'VPN gerekmez'},
} as const;
const purposeIcons:Record<Purpose,IconName>={personal:'person-outline',student:'school-outline',business:'briefcase-outline',fitness:'barbell-outline',realestate:'home-outline'};
const CODE_LENGTH=4;

type Step='intro'|'phone'|'code'|'profile'|'email';
export function Onboarding({locale,onLocale,introSeen,onSignedIn}:{locale:Locale;onLocale:(l:Locale)=>void;introSeen:boolean;onSignedIn:()=>void}){
 const {c,rtl}=useTheme();const t=copy[locale];
 const [step,setStep]=useState<Step>(introSeen?'phone':'intro');const [slide,setSlide]=useState(0);
 const [phone,setPhone]=useState('');const [sentTo,setSentTo]=useState('');const [code,setCode]=useState('');const [wait,setWait]=useState(0);
 const [name,setName]=useState('');const [purpose,setPurpose]=useState<Purpose>('personal');
 const [email,setEmail]=useState('');const [password,setPassword]=useState('');
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [devCode,setDevCode]=useState('');
 const codeInput=useRef<TextInput>(null);const verifying=useRef(false);
 useEffect(()=>{if(wait<=0)return;const timer=setTimeout(()=>setWait(w=>w-1),1000);return()=>clearTimeout(timer);},[wait]);
 const fail=(err:unknown)=>setError(err instanceof ApiError?err.message:t.error);
 const configError=apiConfigurationError(locale);

 async function sendCode(){
  if(busy)return;setError('');
  if(!/^[0-9۰-۹٠-٩+\s-]{10,16}$/.test(phone.trim())){setError(t.invalidPhone);return;}
  setBusy(true);
  try{const res=await requestOtp(phone,locale);setSentTo(res.phone);setWait(res.resendAfterSec);setCode('');setDevCode(__DEV__&&res.devCode?res.devCode:'');setStep('code');setTimeout(()=>codeInput.current?.focus(),300);}
  catch(err){fail(err);}finally{setBusy(false);}
 }
 async function verify(value:string){
  if(verifying.current)return;verifying.current=true;setBusy(true);setError('');
  try{const needsProfile=await verifyOtp(sentTo,value,locale);success();if(needsProfile)setStep('profile');else onSignedIn();}
  catch(err){fail(err);setCode('');}finally{verifying.current=false;setBusy(false);}
 }
 async function saveProfile(){
  if(busy||!name.trim())return;setBusy(true);setError('');
  try{await request('/api/user/profile',locale,{method:'PATCH',body:JSON.stringify({name:name.trim(),language:locale})});await updatePreferences({purpose});success();onSignedIn();}
  catch(err){fail(err);}finally{setBusy(false);}
 }
 async function emailLogin(){
  if(busy)return;setBusy(true);setError('');
  try{await signIn(email,password,locale);setPassword('');onSignedIn();}catch(err){fail(err);}finally{setBusy(false);}
 }
 const finishIntro=()=>{void updatePreferences({introSeen:true}).catch(()=>{});setStep('phone');};

 const languages=<Row gap={space.sm}>{(['fa','en','tr'] as Locale[]).map(l=><Chip key={l} label={{fa:'فارسی',en:'English',tr:'Türkçe'}[l]} tone={l===locale?'soft':'raised'} onPress={()=>onLocale(l)}/>)}</Row>;
 const brand=<AppText variant="title" weight="bold" align="center">AI<AppText variant="title" weight="bold" tone="accent">Fekr</AppText></AppText>;

 let body;
 if(step==='intro'){
  const [icon,title,detail]=t.slides[slide];const last=slide===t.slides.length-1;
  body=<>
   <Row justify="space-between">{brand}<Pressable accessibilityRole="button" onPress={finishIntro} hitSlop={10}><AppText variant="caption" tone="muted">{t.skip}</AppText></Pressable></Row>
   {languages}
   <View style={s.hero}><View style={[s.heroIcon,{backgroundColor:c.soft}]}><Icon name={icon as IconName} size={44} color={c.accent}/></View>
    <AppText variant="display" weight="bold" align="center">{title}</AppText><AppText tone="muted" align="center">{detail}</AppText></View>
   <Row gap={6} justify="center">{t.slides.map((_,i)=><View key={i} style={[s.dot,{backgroundColor:i===slide?c.accent:c.border,width:i===slide?22:8}]}/>)}</Row>
   <Button label={last?t.start:t.next} icon={last?undefined:'arrow-forward'} onPress={()=>last?finishIntro():setSlide(slide+1)}/>
  </>;
 }else if(step==='phone'){
  body=<>
   <Row justify="space-between">{brand}{languages}</Row>
   <View style={{gap:space.sm,marginTop:space.xxl}}><AppText variant="display" weight="bold" accessibilityRole="header">{t.phoneTitle}</AppText><AppText tone="muted">{t.phoneHint}</AppText></View>
   <Field large accessibilityLabel={t.phone} placeholder="0912 345 6789" value={phone} onChangeText={setPhone} keyboardType="phone-pad" textContentType="telephoneNumber" autoComplete="tel" maxLength={16} editable={!busy} onSubmitEditing={()=>void sendCode()} style={{textAlign:'left',writingDirection:'ltr',letterSpacing:1}}/>
   <Button label={t.cont} busy={busy} onPress={()=>void sendCode()}/>
   <Pressable accessibilityRole="button" onPress={()=>{setError('');setStep('email');}} style={{alignSelf:'center',padding:space.sm}}><AppText variant="caption" tone="muted">{t.email}</AppText></Pressable>
   <View style={{flex:1}}/>
   <Row justify="center" gap={6}><Icon name="shield-checkmark-outline" size={16} color={c.softText}/><AppText variant="caption" tone="softText">{t.gift}</AppText></Row>
  </>;
 }else if(step==='code'){
  body=<>
   <Row><IconButton icon="arrow-back" label={t.change} mirror onPress={()=>{setStep('phone');setError('');}}/></Row>
   <View style={{gap:space.sm}}><AppText variant="display" weight="bold" accessibilityRole="header">{t.codeTitle}</AppText><AppText tone="muted">{t.codeHint(sentTo)}</AppText></View>
   {/* The real input lies transparently over the boxes, so a tap anywhere on them focuses it and SMS autofill lands in one field. */}
   <View style={s.codeRow}>
    {Array.from({length:CODE_LENGTH},(_,i)=><View key={i} style={[s.codeBox,{backgroundColor:c.raised,borderColor:i===code.length?c.accent:'transparent'}]}><AppText variant="display" weight="bold" align="center">{code[i]??''}</AppText></View>)}
    <TextInput ref={codeInput} accessibilityLabel={t.codeTitle} value={code} maxLength={CODE_LENGTH} keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="sms-otp" autoFocus editable={!busy} caretHidden
     onChangeText={value=>{const digits=value.replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/\D/g,'').slice(0,CODE_LENGTH);setCode(digits);if(digits.length===CODE_LENGTH)void verify(digits);}} style={s.codeInput}/>
   </View>
   {devCode?<AppText variant="caption" tone="faint" align="center">dev: {devCode}</AppText>:null}
   <Button label={t.cont} busy={busy} disabled={code.length!==CODE_LENGTH} onPress={()=>void verify(code)}/>
   <Pressable accessibilityRole="button" disabled={wait>0||busy} onPress={()=>void sendCode()} style={{alignSelf:'center',padding:space.sm}}><AppText variant="caption" tone={wait>0?'faint':'accent'}>{wait>0?t.resendIn(numberFormat(locale,wait)):t.resend}</AppText></Pressable>
  </>;
 }else if(step==='profile'){
  body=<>
   <View style={{gap:space.sm,marginTop:space.xl}}><AppText variant="display" weight="bold" accessibilityRole="header">{t.profileTitle}</AppText><AppText tone="muted">{t.profileHint}</AppText></View>
   <Field accessibilityLabel={t.name} placeholder={t.name} value={name} onChangeText={setName} maxLength={60} autoComplete="name" textContentType="name"/>
   <View style={{flexDirection:rtl?'row-reverse':'row',flexWrap:'wrap',gap:space.sm}}>{purposes.map(p=><Chip key={p} icon={purposeIcons[p]} label={t.purpose[p]} tone={p===purpose?'soft':'raised'} onPress={()=>setPurpose(p)}/>)}</View>
   <View style={{flex:1}}/>
   <Button label={t.done} busy={busy} disabled={!name.trim()} onPress={()=>void saveProfile()}/>
  </>;
 }else{
  body=<>
   <Row><IconButton icon="arrow-back" label={t.back} mirror onPress={()=>{setStep('phone');setError('');}}/></Row>
   <AppText variant="display" weight="bold" accessibilityRole="header">{t.emailTitle}</AppText>
   <Field accessibilityLabel="Email" placeholder="name@example.com" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" style={{textAlign:'left'}}/>
   <Field accessibilityLabel={t.password} placeholder={t.password} value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" onSubmitEditing={()=>void emailLogin()}/>
   <Button label={t.login} busy={busy} onPress={()=>void emailLogin()}/>
  </>;
 }
 return <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}>
  <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.page}>
   {configError?<Banner text={configError}/>:null}
   {body}
   {error?<Banner text={error}/>:null}
  </ScrollView>
 </KeyboardAvoidingView>;
}
const s=StyleSheet.create({
 page:{flexGrow:1,padding:space.xl,gap:space.lg},
 hero:{flex:1,minHeight:320,alignItems:'center',justifyContent:'center',gap:space.lg,paddingHorizontal:space.md},
 heroIcon:{width:96,height:96,borderRadius:32,alignItems:'center',justifyContent:'center',marginBottom:space.md},
 dot:{height:8,borderRadius:4},
 // Digits always read left to right, even in the Persian UI.
 codeRow:{flexDirection:'row',justifyContent:'center',gap:space.md,marginVertical:space.lg},
 codeBox:{width:58,height:68,borderRadius:radius.md,borderWidth:2,alignItems:'center',justifyContent:'center'},
 codeInput:{...StyleSheet.absoluteFill,opacity:0.011,color:'transparent',fontFamily:fonts.regular},
});
