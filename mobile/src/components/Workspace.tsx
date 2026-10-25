import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ApiError, hasSession, logout, profile, request } from '../api';
import { Locale, strings } from '../i18n';
import { router, useLocalSearchParams } from 'expo-router';
import { ChatScreen } from './ChatScreen';
import { StudioScreen } from './StudioScreen';
import { BusinessScreen } from './BusinessScreen';
import { ContactDetail } from './ContactDetail';
import { FitnessScreen } from './FitnessScreen';
import {readPreferences,updatePreferences,type Purpose} from '../preferences';
import {fonts,palettes} from '../design';
import {Onboarding} from './Onboarding';
import {ThemeProvider} from '../ui/theme';
import {Icon,tap,type IconName} from '../ui/kit';
import {HomeScreen} from './HomeScreen';
import {StudentScreen} from './StudentScreen';
import {ProfileScreen} from './ProfileScreen';
import {GlobalSearch} from './GlobalSearch';
import {OfflineSync} from './OfflineSync';

type Tab = 'home' | 'fika' | 'create' | 'work' | 'you';
const tabIcons:Record<Tab,[IconName,IconName]>={home:['home-outline','home'],fika:['sparkles-outline','sparkles'],create:['color-wand-outline','color-wand'],work:['briefcase-outline','briefcase'],you:['person-outline','person']};
type ChatIntent={prompt?:string;conversation?:string;voice?:boolean;nonce:number};
type Account = {name:string; plan:string; displayCredits:number};
export default function App() {
  const [locale,setLocale] = useState<Locale>('fa');
  const [mode,setMode] = useState<'dark'|'light'|'system'>('system');
  const [introSeen,setIntroSeen]=useState(true);const [purpose,setPurpose]=useState<Purpose|undefined>();const [prefsReady,setPrefsReady]=useState(false);const [chat,setChat]=useState<ChatIntent>({nonce:0});
  const loadPrefs=useCallback(()=>readPreferences().then(p=>{setLocale(p.locale);setMode(p.mode);setIntroSeen(p.introSeen);setPurpose(p.purpose);}).catch(()=>{}).finally(()=>setPrefsReady(true)),[]);
  useEffect(()=>{void loadPrefs();},[loadPrefs]);
  const system = useColorScheme(); const dark = mode === 'dark' || (mode === 'system' && system !== 'light');
  const c = dark ? palettes.dark : palettes.light;
  const t = strings[locale]; const rtl = locale === 'fa';
  const [signed,setSigned] = useState(false); const [ready,setReady] = useState(false);
  const params = useLocalSearchParams<{tab?:string;courseId?:string}>();
  const tab:Tab = ['home','fika','create','work','you'].includes(params.tab || '') ? params.tab as Tab : 'home';
  const setTab = (value:Tab) => router.setParams({tab:value});
  const [account,setAccount] = useState<Account|null>(null);const [selectedContact,setSelectedContact]=useState<string|null>(null);
  const [busy,setBusy] = useState(false); const [error,setError] = useState(''); const [revision,setRevision] = useState(0);const [accountType,setAccountType]=useState('PERSONAL');const [showFitness,setShowFitness]=useState(false);const [showStudent,setShowStudent]=useState(false);
  const tx = {color:c.text,textAlign:rtl?'right' as const:'left' as const};
  useEffect(()=>{
    const subscription=AppState.addEventListener('change',state=>{
      if(state==='active')setRevision(v=>v+1);
      else setAccount(null);
    });
    return()=>subscription.remove();
  },[]);
  const handleError = useCallback((err:unknown)=>{
    if(err instanceof ApiError&&err.status===401){setSigned(false);setAccount(null);setShowFitness(false);setShowStudent(false);setSelectedContact(null);setAccountType('PERSONAL');}
    setError(err instanceof ApiError?err.message:t.error);
  },[t.error]);
  useEffect(() => { hasSession().then(setSigned).catch(() => setError(t.error)).finally(() => setReady(true)); }, [t.error]);
  useEffect(() => {
    if (!signed || (tab !== 'home' && tab !== 'you')) return;
    let active = true;
    // Clear the previous authorized response before fetching a new account/locale/tab.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBusy(true); setError(''); setAccount(null);
    request('/api/user/profile',locale).then(data => {
      if (!active || AppState.currentState !== 'active') return;
      const dataProfile=profile.parse(data).user;setAccount(dataProfile);setAccountType(dataProfile.accountType||'PERSONAL');
    }).catch(err => {
      if (!active) return;
      if (err instanceof ApiError && err.status === 401) { setSigned(false); setAccount(null); setError(t.expired); }
      else setError(err instanceof ApiError ? err.message : t.error);
    }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [signed,tab,locale,revision,t.error,t.expired,showFitness,showStudent,accountType]);
  const button = (label:string,action:()=>void,selected=false) => <Pressable accessibilityRole="button" accessibilityState={{disabled:busy,selected}} disabled={busy} onPress={action} style={[s.button,{backgroundColor:selected?'#FF6B00':c.surface,borderColor:c.border}]}><Text style={{color:selected?'#171719':c.text,fontWeight:'600'}}>{label}</Text></Pressable>;
  async function leave() {
    setBusy(true); setError('');
    try { const result=await logout(locale); setSigned(false); setAccount(null);setAccountType('PERSONAL');setShowFitness(false);setShowStudent(false);setSelectedContact(null);if(!result.revoked||result.localCleared===false)setError(t.error); }
    catch { setError(t.error); } finally { setBusy(false); }
  }
  const openChat=(intent:Omit<ChatIntent,'nonce'>)=>{setChat(v=>({...intent,nonce:v.nonce+1}));setTab('fika');};
  const changeLocale=(l:Locale)=>{setLocale(l);void updatePreferences({locale:l}).catch(handleError);if(signed)void request('/api/user/profile',l,{method:'PATCH',body:JSON.stringify({language:l})}).catch(handleError);};
  return <ThemeProvider value={{c,dark,locale,rtl}}><SafeAreaProvider><SafeAreaView style={[s.root,{backgroundColor:c.bg}]}>
    <StatusBar style={dark?'light':'dark'} />
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS==='ios'?'padding':undefined}>
      {signed&&tab!=='fika'?<View style={[s.header,{flexDirection:rtl?'row-reverse':'row'}]}><Text accessibilityRole="header" style={[s.brand,{color:c.text}]}>AI<Text style={{color:c.accent}}>Fekr</Text></Text></View>:null}
      
      {error&&signed ? <View style={s.notice}><Text accessibilityRole="alert" style={{color:dark?'#FFB89C':'#9C2700'}}>{error}</Text>{signed && button(t.retry,()=>setRevision(v=>v+1))}</View>:null}
      {!ready || !prefsReady || (busy&&signed) ? <ActivityIndicator accessibilityLabel={t.loading} color="#FF6B00" style={{margin:16}}/>:null}
      {ready && prefsReady && !signed ? <Onboarding locale={locale} onLocale={changeLocale} introSeen={introSeen} onSignedIn={()=>{setError('');setSigned(true);setTab('home');void loadPrefs();}}/>:ready && signed ? <View style={s.root}>
        {tab==='work'&&showStudent?<StudentScreen initialCourseId={params.courseId} locale={locale} palette={c} onError={handleError} onClose={()=>{setShowStudent(false);setTab('home');}}/>:tab==='work'&&(showFitness||accountType==='FITNESS')?<FitnessScreen locale={locale} color={c.text} surface={c.surface} onError={handleError} onClose={()=>{setShowFitness(false);setTab('home');}}/>:tab==='work'&&selectedContact?<ContactDetail id={selectedContact} locale={locale} onError={handleError} onClose={()=>{setSelectedContact(null);setRevision(v=>v+1);}} workspaceRevision={revision}/>:tab === 'work' ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}><BusinessScreen locale={locale} onError={handleError} onContact={id=>setSelectedContact(id)} workspaceRevision={revision} onWorkspaceChange={()=>{setAccount(null);setRevision(v=>v+1);}}/></ScrollView>:
        tab==='fika'?<ChatScreen key={chat.nonce} locale={locale} onError={handleError} initialPrompt={chat.prompt} initialConversation={chat.conversation} openVoice={chat.voice}/>:
        tab==='create'?<StudioScreen locale={locale} color={c.text} surface={c.surface} onError={handleError}/>:
        <ScrollView contentContainerStyle={s.content}>
          {tab!=='home'&&tab!=='you'?<Text accessibilityRole="header" style={[s.title,tx]}>{t[tab]}</Text>:null}
          
          {tab==='home'?<HomeScreen locale={locale} account={account} purpose={purpose} fitnessOnly={accountType==='FITNESS'} onAsk={prompt=>openChat(prompt?{prompt}:{voice:true})} onOpenChat={id=>openChat({conversation:id})} onOpen={target=>{if(target==='fika'){openChat({});return;}setSelectedContact(null);setShowFitness(target==='fitness');setShowStudent(target==='student');setTab(target==='fitness'||target==='student'?'work':target);}}/>:null}{tab==='home'&&accountType!=='FITNESS'?<GlobalSearch key={locale+revision} locale={locale} color={c.text} surface={c.surface} onError={handleError} onContact={id=>{setSelectedContact(id);setShowStudent(false);setShowFitness(false);setTab('work');}}/>:null}
          {tab==='you'?<ProfileScreen locale={locale} account={account} mode={mode} onMode={m=>{setMode(m);void updatePreferences({mode:m}).catch(handleError);}} onLocale={changeLocale} onLogout={()=>void leave()} onCourse={id=>{setShowStudent(true);setShowFitness(false);router.setParams({tab:'work',courseId:id});}} onError={handleError}/>:null}
        </ScrollView>}
        <View accessibilityRole="tablist" style={[s.nav,{backgroundColor:c.surface,borderColor:c.border,flexDirection:rtl?'row-reverse':'row'}]}>{(['home','fika','create','work','you'] as Tab[]).map(item=><Pressable key={item} accessibilityRole="tab" accessibilityState={{selected:tab===item}} onPress={()=>{tap();if(item==='fika'&&tab!=='fika')openChat({});else setTab(item);}} style={s.tab}><Icon name={tabIcons[item][tab===item?1:0]} size={24} color={tab===item?c.accent:c.faint}/><Text style={{color:tab===item?c.accent:c.faint,fontSize:11,fontFamily:fonts.medium,marginTop:2}}>{t[item]}</Text></Pressable>)}</View>
      <OfflineSync locale={locale}/></View>:null}
    </KeyboardAvoidingView>
  </SafeAreaView></SafeAreaProvider></ThemeProvider>;
}
const s = StyleSheet.create({root:{flex:1},header:{paddingHorizontal:24,paddingTop:12,paddingBottom:4,alignItems:'center',justifyContent:'space-between'},brand:{fontSize:22,fontFamily:fonts.bold},languages:{flexDirection:'row',paddingHorizontal:16,gap:8},content:{padding:24,gap:16},title:{fontSize:30,fontWeight:'700',marginBottom:8},subtitle:{fontSize:20,fontWeight:'600'},caption:{fontSize:15,lineHeight:24},input:{minHeight:52,borderWidth:1,borderRadius:16,padding:16},button:{minHeight:48,borderWidth:1,borderRadius:16,paddingHorizontal:16,paddingVertical:12,alignItems:'center',justifyContent:'center'},card:{borderWidth:1,borderRadius:24,padding:24,gap:12,marginBottom:12},balance:{fontSize:42,fontWeight:'700'},notice:{padding:16,gap:8},nav:{borderTopWidth:1,paddingVertical:6,paddingHorizontal:8},tab:{flex:1,minHeight:52,alignItems:'center',justifyContent:'center'}});
